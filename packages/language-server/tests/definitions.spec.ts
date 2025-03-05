import { TextDocument } from '@volar/language-server';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server.js';

test('TS to vue', async () => {
	expect(
		await requestDefinition('tsconfigProject/fixture1.ts', 'typescript', `import C|omponent from './empty.vue';`)
	).toMatchInlineSnapshot(`
		[
		  {
		    "contextEnd": {
		      "line": 1,
		      "offset": 37,
		    },
		    "contextStart": {
		      "line": 1,
		      "offset": 1,
		    },
		    "end": {
		      "line": 1,
		      "offset": 17,
		    },
		    "file": "\${testWorkspacePath}/tsconfigProject/fixture1.ts",
		    "start": {
		      "line": 1,
		      "offset": 8,
		    },
		  },
		]
	`);
	expect(
		await requestDefinition('tsconfigProject/fixture2.ts', 'typescript', `import Component from '|./empty.vue';`)
	).toMatchInlineSnapshot(`
		[
		  {
		    "end": {
		      "line": 1,
		      "offset": 1,
		    },
		    "file": "\${testWorkspacePath}/tsconfigProject/empty.vue",
		    "start": {
		      "line": 1,
		      "offset": 1,
		    },
		    "unverified": true,
		  },
		]
	`);
});

test('Alias path', async () => {
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
		    "contextEnd": {
		      "line": 1,
		      "offset": 26,
		    },
		    "contextStart": {
		      "line": 1,
		      "offset": 1,
		    },
		    "end": {
		      "line": 1,
		      "offset": 17,
		    },
		    "file": "\${testWorkspacePath}/tsconfigProject/foo.ts",
		    "start": {
		      "line": 1,
		      "offset": 14,
		    },
		  },
		]
	`);
});

test('#2600', async () => {
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
		    "end": {
		      "line": 1,
		      "offset": 1,
		    },
		    "file": "\${testWorkspacePath}/tsconfigProject/foo.vue",
		    "start": {
		      "line": 1,
		      "offset": 1,
		    },
		  },
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

async function requestDefinition(fileName: string, languageId: string, content: string) {
	const offset = content.indexOf('|');
	expect(offset).toBeGreaterThanOrEqual(0);
	content = content.slice(0, offset) + content.slice(offset + 1);

	const server = await getLanguageServer();
	let document = await prepareDocument(fileName, languageId, content);

	const res = await server.tsserver.message({
		seq: server.nextSeq(),
		command: 'definition',
		arguments: {
			file: URI.parse(document.uri).fsPath,
			position: offset,
		},
	});
	expect(res.success).toBe(true);

	for (const ref of res.body) {
		ref.file = '${testWorkspacePath}' + ref.file.slice(testWorkspacePath.length);
	}

	return res.body;
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
