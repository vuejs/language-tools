import { TextDocument } from '@volar/language-server';
import { afterEach, describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server.js';

describe('Definitions', async () => {

	it('Default slot', async () => {
		await prepareDocument('tsconfigProject/foo.vue', 'vue', `
			<script setup lang="ts">
			import Fixture from './fixture.vue';
			</script>

			<template>
				<Fixture>
					<div></div>
				</Fixture>
			</template>
		`);
		expect(
			await requestReferences('tsconfigProject/fixture.vue', 'vue', `
				<template>
					<slot|></slot>
				</template>
			`)
		).toMatchInlineSnapshot(`
			[
			  {
			    "range": {
			      "end": {
			        "character": 16,
			        "line": 7,
			      },
			      "start": {
			        "character": 5,
			        "line": 7,
			      },
			    },
			    "uri": "file://\${testWorkspacePath}/tsconfigProject/foo.vue",
			  },
			  {
			    "range": {
			      "end": {
			        "character": 10,
			        "line": 2,
			      },
			      "start": {
			        "character": 6,
			        "line": 2,
			      },
			    },
			    "uri": "file://\${testWorkspacePath}/tsconfigProject/fixture.vue",
			  },
			]
		`);
	});

	it('Named slot', async () => {
		await prepareDocument('tsconfigProject/foo.vue', 'vue', `
			<script setup lang="ts">
			import Fixture from './fixture.vue';
			</script>

			<template>
				<Fixture #foo></Fixture>
			</template>
		`);
		expect(
			await requestReferences('tsconfigProject/fixture.vue', 'vue', `
			<template>
				<slot name="|foo"></slot>
			</template>
		`)
		).toMatchInlineSnapshot(`
			[
			  {
			    "range": {
			      "end": {
			        "character": 17,
			        "line": 6,
			      },
			      "start": {
			        "character": 14,
			        "line": 6,
			      },
			    },
			    "uri": "file://\${testWorkspacePath}/tsconfigProject/foo.vue",
			  },
			  {
			    "range": {
			      "end": {
			        "character": 19,
			        "line": 2,
			      },
			      "start": {
			        "character": 16,
			        "line": 2,
			      },
			    },
			    "uri": "file://\${testWorkspacePath}/tsconfigProject/fixture.vue",
			  },
			]
		`);
	});

	it('v-bind shorthand', async () => {
		expect(
			await requestReferences('tsconfigProject/fixture.vue', 'vue', `
				<script setup lang="ts">
				const |foo = 1;
				</script>

				<template>
					<Foo :foo></Foo>
				</template>
			`)
		).toMatchInlineSnapshot(`
			[
			  {
			    "range": {
			      "end": {
			        "character": 14,
			        "line": 6,
			      },
			      "start": {
			        "character": 11,
			        "line": 6,
			      },
			    },
			    "uri": "file://\${testWorkspacePath}/tsconfigProject/fixture.vue",
			  },
			  {
			    "range": {
			      "end": {
			        "character": 13,
			        "line": 2,
			      },
			      "start": {
			        "character": 10,
			        "line": 2,
			      },
			    },
			    "uri": "file://\${testWorkspacePath}/tsconfigProject/fixture.vue",
			  },
			]
		`);
	});

	const openedDocuments: TextDocument[] = [];

	afterEach(async () => {
		const server = await getLanguageServer();
		for (const document of openedDocuments) {
			await server.closeTextDocument(document.uri);
		}
		openedDocuments.length = 0;
	});

	async function requestReferences(fileName: string, languageId: string, content: string) {
		const offset = content.indexOf('|');
		expect(offset).toBeGreaterThanOrEqual(0);
		content = content.slice(0, offset) + content.slice(offset + 1);

		const server = await getLanguageServer();
		let document = await prepareDocument(fileName, languageId, content);

		const position = document.positionAt(offset);
		const references = await server.sendReferencesRequest(document.uri, position, { includeDeclaration: false });
		expect(references).toBeDefined();

		for (const loc of references!) {
			loc.uri = 'file://${testWorkspacePath}' + loc.uri.slice(URI.file(testWorkspacePath).toString().length);
		}

		return references!;
	}

	async function prepareDocument(fileName: string, languageId: string, content: string) {
		const server = await getLanguageServer();
		const uri = URI.file(`${testWorkspacePath}/${fileName}`);
		const document = await server.openInMemoryDocument(uri.toString(), languageId, content);
		if (openedDocuments.every(d => d.uri !== document.uri)) {
			openedDocuments.push(document);
		}
		return document;
	}
});
