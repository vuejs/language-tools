import { DocumentHighlightRequest, type TextDocument } from '@volar/language-server';
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

test('#5487 #5580 tag names highlight only their matching tag', async () => {
	expect(
		await highlight(`
<script setup lang="ts">
import Comp from './Comp.vue';
</script>

<template>
	<div>
		<d|iv></div>
	</div>
	<Comp></Comp>
	<Comp></Comp>
</template>
`),
	).toEqual(['div', 'div']);
	expect(
		await highlight(`
<script setup lang="ts">
import Comp from './Comp.vue';
</script>

<template>
	<div><div></div></div>
	<Co|mp></Comp>
	<Comp></Comp>
</template>
`),
	).toEqual(['Comp', 'Comp']);
});

test('template identifiers highlight their script references', async () => {
	expect(
		await highlight(`
<script setup lang="ts">
const msg = 'hi';
</script>

<template>
	<div :title="msg">{{ m|sg }}</div>
</template>
`),
	).toEqual(['msg', 'msg', 'msg']);
});

async function highlight(content: string) {
	const server = await getLanguageServer();
	const offset = content.indexOf('|');
	content = content.slice(0, offset) + content.slice(offset + 1);
	const uri = URI.file(`${testWorkspacePath}/documentHighlights.vue`).toString();
	const document = await server.open(uri, 'vue', content);
	if (openedDocuments.every(d => d.uri !== document.uri)) {
		openedDocuments.push(document);
	}
	const highlights = await server.vueserver.connection.sendRequest(DocumentHighlightRequest.type, {
		textDocument: { uri: document.uri },
		position: document.positionAt(offset),
	});
	return (highlights ?? [])
		.sort((a, b) => document.offsetAt(a.range.start) - document.offsetAt(b.range.start))
		.map(({ range }) => document.getText(range));
}
