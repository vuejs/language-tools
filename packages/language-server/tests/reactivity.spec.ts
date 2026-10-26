import type { TextDocument } from '@volar/language-server';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import type { ReactivityAnalysisResult } from '../lib/reactivity';
import { getLanguageServer, testWorkspacePath } from './server';

const script = `import { computed, ref } from 'vue';
const count = ref(0);
const double = computed(() => count.value * 2);
`;

test('reactivity analysis of a Vue file maps the dependents back to the SFC', async () => {
	const content = `<script setup lang="ts">\n${script}</script>\n\n<template>{{ double }}</template>\n`;
	const document = await open('tsconfigProject/fixture.vue', 'vue', content);
	expect(slice(content, await analyze(document.uri, content.indexOf('count = ref') + 1))).toEqual({
		dependencyRanges: [],
		dependentRanges: ['count.value * 2'],
	});
	expect(slice(content, await analyze(document.uri, content.indexOf('* 2')))).toEqual({
		dependencyRanges: ['count'],
		dependentRanges: [],
	});
});

test('reactivity analysis of a Vue file reads its script blocks as written', async () => {
	const content = `<script setup lang="ts">
import { useTemplateRef, watchEffect } from 'vue';
const el = useTemplateRef('el');
watchEffect(() => el.value);
</script>

<template><div ref="el"></div></template>
`;
	const document = await open('tsconfigProject/fixture.vue', 'vue', content);
	expect(slice(content, await analyze(document.uri, content.indexOf('el = use')))).toEqual({
		dependencyRanges: [],
		dependentRanges: ['el.value'],
	});
	expect(await analyze(document.uri, content.indexOf('ref="el"'))).toBeFalsy();
});

test('reactivity analysis of a script the client sends', async () => {
	const uri = URI.file(`${testWorkspacePath}/tsconfigProject/composable.ts`).toString();
	expect(slice(script, await analyze(uri, script.indexOf('count = ref') + 1, script))).toEqual({
		dependencyRanges: [],
		dependentRanges: ['count.value * 2'],
	});
});

test('interpolation ranges cover the template interpolations', async () => {
	const content = `<template>\n\t<div>{{ foo }}</div>\n\t{{ bar + 1 }}\n</template>\n`;
	const document = await open('tsconfigProject/fixture.vue', 'vue', content);
	const server = await getLanguageServer();
	const ranges: [number, number][] = await server.vueserver.connection.sendRequest('vue/interpolationRanges', {
		textDocument: { uri: document.uri },
	});
	expect(ranges.map(([start, end]) => content.slice(start, end))).toEqual([' foo ', ' bar + 1 ']);
});

test('interpolation ranges cover every template interpolation and style v-bind() expression', async () => {
	const content = `<template>
	<div>{{ () => foo }}</div>
	{{
		bar
	}}
	{{ baz
	}}
</template>

<style>
.foo { color: v-bind(color); }
</style>
`;
	const document = await open('tsconfigProject/fixture.vue', 'vue', content);
	const server = await getLanguageServer();
	const ranges: [number, number][] = await server.vueserver.connection.sendRequest('vue/interpolationRanges', {
		textDocument: { uri: document.uri },
	});
	expect(ranges.map(([start, end]) => content.slice(start, end))).toEqual([
		' () => foo ',
		'\n\t\tbar\n\t',
		' baz\n\t',
		'color',
	]);
});

const openedDocuments: TextDocument[] = [];

afterEach(async () => {
	const server = await getLanguageServer();
	for (const document of openedDocuments) {
		await server.close(document.uri);
	}
	openedDocuments.length = 0;
});

async function open(fileName: string, languageId: string, content: string) {
	const server = await getLanguageServer();
	const document = await server.open(URI.file(`${testWorkspacePath}/${fileName}`).toString(), languageId, content);
	openedDocuments.push(document);
	return document;
}

async function analyze(uri: string, offset: number, content?: string) {
	const server = await getLanguageServer();
	return await server.vueserver.connection.sendRequest<ReactivityAnalysisResult>('vue/reactivityAnalysis', {
		textDocument: { uri },
		offset,
		content,
	});
}

function slice(text: string, result: ReactivityAnalysisResult | undefined) {
	return result && {
		dependencyRanges: result.dependencyRanges.map(({ pos, end }) => text.slice(pos, end)),
		dependentRanges: result.dependentRanges.map(({ pos, end }) => text.slice(pos, end)),
	};
}
