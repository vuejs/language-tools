import type { TextDocument } from '@volar/language-server';
import { AutoInsertRequest } from '@volar/language-server/protocol';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

test('.value in script setup', async () => {
	expect(
		await requestAutoInsertToVueServer(
			'fixture.vue',
			'vue',
			`
<script setup lang="ts">
import { ref } from 'vue';
const foo = ref(0);
fo|
</script>
`,
			'o',
		),
	).toBe('${1:.value}');
});

test('#6272', async () => {
	expect(
		await requestAutoInsertToVueServer(
			'fixture.vue',
			'vue',
			`
<script setup lang="ts">
import { ref } from 'vue';
const foo = ref(0);
</script>

<template>
	{{ fo| }}
</template>
`,
			'o',
		),
	).toBeFalsy();
});

const openedDocuments: TextDocument[] = [];

afterEach(async () => {
	const server = await getLanguageServer();
	for (const document of openedDocuments) {
		await server.close(document.uri);
	}
	openedDocuments.length = 0;
});

async function requestAutoInsertToVueServer(fileName: string, languageId: string, content: string, text: string) {
	const offset = content.indexOf('|');
	expect(offset).toBeGreaterThanOrEqual(0);
	content = content.slice(0, offset) + text + content.slice(offset + 1);

	const server = await getLanguageServer();
	const uri = URI.file(`${testWorkspacePath}/${fileName}`);
	const document = await server.open(uri.toString(), languageId, content);
	openedDocuments.push(document);

	return await server.vueserver.connection.sendRequest(AutoInsertRequest.type, {
		textDocument: { uri: document.uri },
		selection: document.positionAt(offset + text.length),
		change: {
			rangeOffset: offset,
			rangeLength: 0,
			text,
		},
	});
}
