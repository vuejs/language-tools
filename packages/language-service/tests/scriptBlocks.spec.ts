import {
	createLanguage,
	createLanguageService,
	createUriMap,
	type LanguageServicePlugin,
} from '@volar/language-service';
import { stringToSnapshot } from '@volar/language-service/lib/utils/common';
import { getDefaultCompilerOptions } from '@vue/language-core';
import { loadTypeScript } from '@vue/language-core/typescript';
import { expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { createVueLanguagePlugin, createVueLanguageServicePlugins, type VueVirtualCode } from '..';
import { create as createTypeScriptSyntacticPlugin, type SyntacticApi } from '../lib/plugins/typescriptSyntactic';
import { createTestEnvironment } from './utils/environment';

// The TypeScript syntactic features of script blocks come from the verbatim code of each block.
// Waits on the project-free syntactic API of TypeScript 7.1 `typescript/sync`, see `vue-typescript-syntactic`.
test.fails('script blocks have TypeScript syntactic features', async () => {
	expect(await getSyntacticFeatures()).toEqual({
		// the block, the JSDoc comment, the function and the JSX element
		foldingRanges: ['0-5', '1-1', '2-4', '4-4'],
		outline: [['script setup', ['add', ['sum']]]],
		jsxClosingTag: '$0</div>',
		formatted: `<script setup lang="tsx">
/** */
function add(a: number) {
	const sum = a + 1;
	return <div>{sum}</div>;
}
</script>
`,
	});
});

// Pins the wiring to a provisional shape of `SyntacticApi`, not an upstream contract: when TypeScript ships the
// project-free syntactic API, the interface and this test follow its shape.
test('the syntactic API gets the parsed AST of each block and the options of the call', async () => {
	const calls: unknown[][] = [];
	const api: Partial<SyntacticApi> = {
		getFoldingRanges(sourceFile) {
			calls.push(['getFoldingRanges', sourceFile]);
			return [];
		},
		getDocumentSymbols(sourceFile) {
			calls.push(['getDocumentSymbols', sourceFile]);
			return [];
		},
		formatRange(sourceFile, _range, options) {
			calls.push(['formatRange', sourceFile.text, options]);
			return [];
		},
	};
	const { languageService, open } = createTestLanguageService(
		createVueLanguageServicePlugins().map(plugin =>
			plugin.name === 'vue-typescript-syntactic' ? createTypeScriptSyntacticPlugin(api) : plugin
		),
		{ 'vue.format.script.initialIndent': true },
	);
	const { uri } = open(
		'api.vue',
		`<template>{{ a+1 }}</template>\n<script setup lang="ts">\nconst a = 1;\n</script>\n`,
	);
	await languageService.getFoldingRanges(uri);
	await languageService.getDocumentSymbols(uri);
	await languageService.getDocumentFormattingEdits(uri, { tabSize: 4, insertSpaces: false }, undefined, undefined);

	const { ast } = (languageService.context.language.scripts.get(uri)!.generated!.root as VueVirtualCode).ir
		.scriptSetup!;
	expect(calls.map(call => call.map(arg => arg === ast ? 'ir.scriptSetup.ast' : arg))).toEqual([
		['getFoldingRanges', 'ir.scriptSetup.ast'],
		['getDocumentSymbols', 'ir.scriptSetup.ast'],
		['formatRange', '\nconst a = 1;\n', { tabSize: 4, insertSpaces: false, baseIndentSize: 4 }],
		['formatRange', '0 + a+1 + 0;', { tabSize: 4, insertSpaces: false, baseIndentSize: 0 }],
	]);
});

async function getSyntacticFeatures() {
	const { open, languageService } = createTestLanguageService(createVueLanguageServicePlugins(), {});
	const toOutline = (symbol: { name: string; children?: typeof symbol[] }): unknown[] => [
		symbol.name,
		...symbol.children?.map(toOutline) ?? [],
	];

	const content = `<script setup lang="tsx">
/** */
function add(a: number) {
const sum   =  a+1;
return <div>{sum}</div>;
}
</script>
`;
	const { uri, document } = open('script.vue', content);
	const foldingRanges = await languageService.getFoldingRanges(uri);
	const symbols = await languageService.getDocumentSymbols(uri);
	const edits = await languageService.getDocumentFormattingEdits(
		uri,
		{ tabSize: 4, insertSpaces: false },
		undefined,
		undefined,
	);

	const jsxContent = `<script setup lang="tsx">
const vnode = <div>;
</script>
`;
	const jsx = open('jsx.vue', jsxContent);
	const jsxClosingTag = await languageService.getAutoInsertSnippet(jsx.uri, jsx.positionAfter('<div>'), {
		rangeOffset: jsxContent.indexOf('<div>') + '<div'.length,
		rangeLength: 0,
		text: '>',
	});

	return {
		foldingRanges: foldingRanges?.map(range => `${range.startLine}-${range.endLine}`).sort(),
		outline: symbols?.map(toOutline),
		jsxClosingTag,
		formatted: [...edits ?? []]
			.sort((a, b) => document.offsetAt(b.range.start) - document.offsetAt(a.range.start))
			.reduce(
				(text, edit) =>
					text.slice(0, document.offsetAt(edit.range.start)) + edit.newText
					+ text.slice(document.offsetAt(edit.range.end)),
				content,
			),
	};
}

function createTestLanguageService(plugins: LanguageServicePlugin[], settings: object) {
	const vuePlugin = createVueLanguagePlugin<URI>(
		loadTypeScript(),
		getDefaultCompilerOptions(),
		uri => uri.path,
	);
	const language = createLanguage<URI>([vuePlugin], createUriMap(false), () => {});
	const languageService = createLanguageService(
		language,
		plugins,
		createTestEnvironment(() => settings),
		{},
	);
	const open = (name: string, content: string) => {
		const uri = URI.file('/' + name);
		const snapshot = stringToSnapshot(content);
		language.scripts.set(uri, snapshot, 'vue');
		const document = languageService.context.documents.get(uri, 'vue', snapshot);
		return { uri, document, positionAfter: (text: string) => document.positionAt(content.indexOf(text) + text.length) };
	};
	return { languageService, open };
}
