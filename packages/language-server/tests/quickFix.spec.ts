import type { TextDocument } from '@volar/language-server';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

const openedDocuments: TextDocument[] = [];

afterEach(async () => {
	const server = await getLanguageServer();
	for (const document of openedDocuments) {
		await server.close(document.uri);
	}
	openedDocuments.length = 0;
});

test('"Add import" quick fix for undefined variable in template', async () => {
	await prepareDocument('tsconfigProject/fixture.ts', 'typescript', `export function foo() {}`);
	expect(
		Object.keys(
			await applyImportFixes(
				'tsconfigProject/fixture.vue',
				`<template>\n\t<button @click="|foo"></button>\n</template>\n\n<script setup lang="ts">\n</script>\n`,
			),
		),
	).toEqual(['Add import from "./fixture"']);
});

const scriptSetup = `<script setup lang="ts">\nconst a = 1;\n</script>\n\n`;

test('"Add import" quick fix for an unresolved name in the template', async () => {
	expect(await applyImportFixes('tsconfigProject/fixture.vue', `${scriptSetup}<template>{{ |NotComp }}</template>`))
		.toEqual({
			'Add import from "./comp"':
				`<script setup lang="ts">\nimport { NotComp } from './comp';\n\nconst a = 1;\n</script>\n\n<template>{{ NotComp }}</template>`,
		});
});

test('"Add import" quick fix for an unresolved component tag', async () => {
	expect(await applyImportFixes('tsconfigProject/fixture.vue', `${scriptSetup}<template><|Empty /></template>`))
		.toEqual({
			'Add import from "./empty.vue"':
				`<script setup lang="ts">\nimport Empty from './empty.vue';\n\nconst a = 1;\n</script>\n\n<template><Empty /></template>`,
		});
	expect(await applyImportFixes('tsconfigProject/fixture.vue', `${scriptSetup}<template><Comp></|Comp></template>`))
		.toEqual({
			'Add import from "./comp"':
				`<script setup lang="ts">\nimport { Comp } from './comp';\n\nconst a = 1;\n</script>\n\n<template><Comp></Comp></template>`,
		});
});

test('"Add import" quick fix into a Vue file without script', async () => {
	expect(await applyImportFixes('tsconfigProject/fixture.vue', `<template>{{ |NotComp }}</template>`)).toEqual({
		'Add import from "./comp"':
			`<script setup lang="ts">\nimport { NotComp } from './comp';\n</script>\n\n<template>{{ NotComp }}</template>`,
	});
});

test('no "Add import" quick fix for a resolved name or a component tag name only exported as a value', async () => {
	expect(
		await applyImportFixes(
			'tsconfigProject/fixture.vue',
			`<script setup lang="ts">\nconst NotComp = 1;\n</script>\n\n<template>{{ |NotComp }}</template>`,
		),
	).toEqual({});
	expect(await applyImportFixes('tsconfigProject/fixture.vue', `${scriptSetup}<template><|NotComp /></template>`))
		.toEqual({});
});

/** The text of the document after each quick fix the Vue language server offers at `|`, by title. */
async function applyImportFixes(fileName: string, content: string) {
	const offset = content.indexOf('|');
	content = content.slice(0, offset) + content.slice(offset + 1);
	const server = await getLanguageServer();
	const document = await prepareDocument(fileName, 'vue', content);
	const position = document.positionAt(offset);
	const actions = await server.vueserver.sendCodeActionsRequest(
		document.uri,
		{ start: position, end: position },
		{ diagnostics: [], only: ['quickfix'] },
	) ?? [];
	const result: Record<string, string> = {};
	for (const action of actions) {
		if (!('edit' in action) || !action.edit?.changes) {
			continue;
		}
		const edits = [...action.edit.changes[document.uri] ?? []]
			.sort((a, b) => document.offsetAt(b.range.start) - document.offsetAt(a.range.start));
		let text = content;
		for (const edit of edits) {
			text = text.slice(0, document.offsetAt(edit.range.start)) + edit.newText
				+ text.slice(document.offsetAt(edit.range.end));
		}
		// The TypeScript language server may generate CRLF on Windows
		result[action.title] = text.replace(/\r\n/g, '\n');
	}
	return result;
}

async function prepareDocument(fileName: string, languageId: string, content: string) {
	const server = await getLanguageServer();
	const uri = URI.file(`${testWorkspacePath}/${fileName}`);
	const document = await server.open(uri.toString(), languageId, content);
	if (openedDocuments.every(d => d.uri !== document.uri)) {
		openedDocuments.push(document);
	}
	return document;
}
