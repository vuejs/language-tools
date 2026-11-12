import { AutoInsertRequest, type TextDocument } from '@volar/language-server';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

test('#6272 interpolation', async () => {
	expect(
		await requestAutoInsertResult(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<script setup lang="ts">
			import { ref } from 'vue';

			const userArr = ref<string[]>([]);
			</script>

			<template>
				{{ userAr| }}
			</template>
		`,
			'r',
		),
	).toBeFalsy();
});

test('#6272 attribute binding', async () => {
	expect(
		await requestAutoInsertResult(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<script setup lang="ts">
			import { ref } from 'vue';

			const userArr = ref<string[]>([]);
			</script>

			<template>
				<div :data-items="userAr| "></div>
			</template>
		`,
			'r',
		),
	).toBeFalsy();
});

test('Script setup', async () => {
	expect(
		await requestAutoInsertResult(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<script setup lang="ts">
			import { ref } from 'vue';

			const userArr = ref<string[]>([]);
			console.log(userAr| );
			</script>
		`,
			'r',
		),
	).toBe('${1:.value}');
});

const openedDocuments: TextDocument[] = [];

afterEach(async () => {
	const server = await getLanguageServer();
	for (const document of openedDocuments) {
		await server.close(document.uri);
	}
	openedDocuments.length = 0;
});

async function requestAutoInsertResult(
	fileName: string,
	languageId: string,
	contentWithCursor: string,
	insertedText: string,
) {
	const server = await getLanguageServer();
	const cursorIndex = contentWithCursor.indexOf('|');
	expect(cursorIndex).toBeGreaterThan(-1);

	const content = contentWithCursor.slice(0, cursorIndex) + insertedText
		+ contentWithCursor.slice(cursorIndex + 1);
	const document = await prepareDocument(fileName, languageId, content);

	return await server.vueserver.connection.sendRequest(AutoInsertRequest.type, {
		textDocument: { uri: document.uri },
		selection: document.positionAt(cursorIndex + insertedText.length),
		change: {
			rangeOffset: cursorIndex,
			rangeLength: 0,
			text: insertedText,
		},
	});
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
