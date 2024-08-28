import { Location, TextDocument } from '@volar/language-server';
import { afterEach, describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server.js';

describe('Definitions', async () => {

	it('TS to vue', async () => {
		expect(
			await requestDefinition('tsconfigProject/fixture1.ts', 'typescript', `import C|omponent from './empty.vue';`)
		).toMatchInlineSnapshot(`
			[
			  {
			    "range": {
			      "end": {
			        "character": 0,
			        "line": 0,
			      },
			      "start": {
			        "character": 0,
			        "line": 0,
			      },
			    },
			    "uri": "file://\${testWorkspacePath}/tsconfigProject/empty.vue",
			  },
			]
		`);
		expect(
			await requestDefinition('tsconfigProject/fixture2.ts', 'typescript', `import Component from '|./empty.vue';`)
		).toMatchInlineSnapshot(`
			[
			  {
			    "range": {
			      "end": {
			        "character": 0,
			        "line": 0,
			      },
			      "start": {
			        "character": 0,
			        "line": 0,
			      },
			    },
			    "uri": "file://\${testWorkspacePath}/tsconfigProject/empty.vue",
			  },
			]
		`);
	});

	it('Alias path', async () => {
		await prepareDocument('tsconfigProject/foo.ts', 'typescript', `export const foo = 'foo';`);
		expect(
			await requestDefinition('tsconfigProject/fixture.vue', 'vue', `
				<script setup lang="ts">
				import { foo| } from '@/foo';
				</script>
			`)
		).toMatchInlineSnapshot(`
			[
			  {
			    "range": {
			      "end": {
			        "character": 25,
			        "line": 0,
			      },
			      "start": {
			        "character": 0,
			        "line": 0,
			      },
			    },
			    "uri": "file://\${testWorkspacePath}/tsconfigProject/foo.ts",
			  },
			]
		`);
	});

	it('#2600', async () => {
		await prepareDocument('tsconfigProject/foo.vue', 'vue', `
			<template>
				<h1>{{ msg }}</h1>
			</template>

			<script lang="ts">
			export default defineProps<{ msg: string }>()
			</script>
		`);
		expect(
			await requestDefinition('tsconfigProject/fixture.vue', 'vue', `
				<script setup lang="ts">
				import Foo from '|@/foo.vue';
				</script>
			`)
		).toMatchInlineSnapshot(`
			[
			  {
			    "range": {
			      "end": {
			        "character": 0,
			        "line": 0,
			      },
			      "start": {
			        "character": 0,
			        "line": 0,
			      },
			    },
			    "uri": "file://\${testWorkspacePath}/tsconfigProject/foo.vue",
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

	async function requestDefinition(fileName: string, languageId: string, content: string) {
		const offset = content.indexOf('|');
		expect(offset).toBeGreaterThanOrEqual(0);
		content = content.slice(0, offset) + content.slice(offset + 1);

		const server = await getLanguageServer();
		let document = await prepareDocument(fileName, languageId, content);

		const position = document.positionAt(offset);
		const definition = await server.sendDefinitionRequest(document.uri, position) as Location[] | null;
		expect(definition).toBeDefined();

		for (const loc of definition!) {
			loc.uri = 'file://${testWorkspacePath}' + loc.uri.slice(URI.file(testWorkspacePath).toString().length);
		}

		return definition!;
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
