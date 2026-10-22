import type { TextDocument } from '@volar/language-server';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { formatLocations, getLanguageServer, testWorkspacePath } from './server';

test('Default slot', async () => {
	await prepareDocument(
		'tsconfigProject/foo.vue',
		'vue',
		`
		<script setup lang="ts">
		import Fixture from './fixture.vue';
		</script>

		<template>
			<Fixture>
				<div></div>
			</Fixture>
		</template>
	`,
	);
	expect(
		await requestReferences(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<slot|></slot>
			</template>
		`,
		),
	).toEqual([
		'tsconfigProject/fixture.vue:2:5-2:9',
		'tsconfigProject/foo.vue:6:3-6:4',
	]);
});

test('Named slot', async () => {
	await prepareDocument(
		'tsconfigProject/foo.vue',
		'vue',
		`
		<script setup lang="ts">
		import Fixture from './fixture.vue';
		</script>

		<template>
			<Fixture #foo></Fixture>
		</template>
	`,
	);
	expect(
		await requestReferences(
			'tsconfigProject/fixture.vue',
			'vue',
			`
		<template>
			<slot name="|foo"></slot>
		</template>
	`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:2:15-2:18",
		  "tsconfigProject/foo.vue:6:13-6:16",
		]
	`);
});

test('v-bind shorthand', async () => {
	expect(
		await requestReferences(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<script setup lang="ts">
			const |foo = 1;
			</script>

			<template>
				<Foo :foo></Foo>
			</template>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:2:9-2:12",
		  "tsconfigProject/fixture.vue:6:10-6:13",
		]
	`);
});

const openedDocuments: TextDocument[] = [];

afterEach(async () => {
	const server = await getLanguageServer();
	for (const document of openedDocuments) {
		await server.close(document.uri);
	}
	openedDocuments.length = 0;
});

async function requestReferences(fileName: string, languageId: string, content: string) {
	const offset = content.indexOf('|');
	expect(offset).toBeGreaterThanOrEqual(0);
	content = content.slice(0, offset) + content.slice(offset + 1);

	const server = await getLanguageServer();
	let document = await prepareDocument(fileName, languageId, content);

	return formatLocations(
		await server.typescript('textDocument/references', {
			textDocument: { uri: document.uri },
			position: document.positionAt(offset),
			context: { includeDeclaration: true },
		}),
	);
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
