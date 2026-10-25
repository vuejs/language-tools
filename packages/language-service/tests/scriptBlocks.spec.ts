import { createLanguage, createLanguageService, createUriMap } from '@volar/language-service';
import { createVueLanguagePlugin, getDefaultCompilerOptions } from '@vue/language-core';
import * as ts from 'typescript';
import { expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { createVueLanguageServicePlugins } from '..';
import { asCoreTypeScript } from '../lib/utils';
import { createTestEnvironment } from './utils/environment';

// The TypeScript syntactic features of script blocks come from the verbatim code of each block.
test('script blocks have TypeScript syntactic features', async () => {
	expect(await getSyntacticFeatures()).toEqual({
		// the block, the JSDoc comment, the function and the JSX element
		foldingRanges: ['0-5', '1-1', '2-4', '4-4'],
		outline: [['script setup', ['add', ['sum']]]],
		jsDocCompletion: [['/** */', '/**\n * $0\n * @param a ${1}\n */']],
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

async function getSyntacticFeatures() {
	const vuePlugin = createVueLanguagePlugin<URI>(
		asCoreTypeScript(ts),
		getDefaultCompilerOptions(),
		uri => uri.path,
	);
	const language = createLanguage<URI>([vuePlugin], createUriMap(false), () => {});
	const languageService = createLanguageService(
		language,
		createVueLanguageServicePlugins(ts),
		createTestEnvironment(() => ({})),
		{},
	);
	const open = (name: string, content: string) => {
		const uri = URI.file('/' + name);
		const snapshot = ts.ScriptSnapshot.fromString(content);
		language.scripts.set(uri, snapshot, 'vue');
		const document = languageService.context.documents.get(uri, 'vue', snapshot);
		return { uri, document, positionAfter: (text: string) => document.positionAt(content.indexOf(text) + text.length) };
	};
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
	const { uri, document, positionAfter } = open('script.vue', content);
	const foldingRanges = await languageService.getFoldingRanges(uri);
	const symbols = await languageService.getDocumentSymbols(uri);
	const completion = await languageService.getCompletionItems(uri, positionAfter('/**'));
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
		jsDocCompletion: completion.items.map(item => [item.label, item.textEdit?.newText]),
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
