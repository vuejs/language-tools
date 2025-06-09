import type { TextDocument } from '@volar/language-server';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server.js';

test('Default slot', async () => {
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
		{
		  "refs": [
		    {
		      "end": {
		        "line": 3,
		        "offset": 10,
		      },
		      "file": "\${testWorkspacePath}/tsconfigProject/fixture.vue",
		      "isDefinition": true,
		      "isWriteAccess": false,
		      "lineText": "				<slot></slot>",
		      "start": {
		        "line": 3,
		        "offset": 6,
		      },
		    },
		    {
		      "end": {
		        "line": 9,
		        "offset": 4,
		      },
		      "file": "\${testWorkspacePath}/tsconfigProject/foo.vue",
		      "isDefinition": false,
		      "isWriteAccess": false,
		      "lineText": "			<Fixture>",
		      "start": {
		        "line": 7,
		        "offset": 13,
		      },
		    },
		  ],
		  "symbolDisplayString": "(property) default?: (props: typeof __VLS_1) => any",
		  "symbolName": "slot",
		  "symbolStartOffset": 6,
		}
	`);
});

test('Named slot', async () => {
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
		{
		  "refs": [
		    {
		      "end": {
		        "line": 3,
		        "offset": 19,
		      },
		      "file": "\${testWorkspacePath}/tsconfigProject/fixture.vue",
		      "isDefinition": true,
		      "isWriteAccess": false,
		      "lineText": "			<slot name="foo"></slot>",
		      "start": {
		        "line": 3,
		        "offset": 16,
		      },
		    },
		    {
		      "end": {
		        "line": 7,
		        "offset": 17,
		      },
		      "file": "\${testWorkspacePath}/tsconfigProject/foo.vue",
		      "isDefinition": false,
		      "isWriteAccess": false,
		      "lineText": "			<Fixture #foo></Fixture>",
		      "start": {
		        "line": 7,
		        "offset": 14,
		      },
		    },
		  ],
		  "symbolDisplayString": "(property) foo?: (props: typeof __VLS_1) => any",
		  "symbolName": "foo",
		  "symbolStartOffset": 16,
		}
	`);
});

test('v-bind shorthand', async () => {
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
		{
		  "refs": [
		    {
		      "contextEnd": {
		        "line": 3,
		        "offset": 18,
		      },
		      "contextStart": {
		        "line": 3,
		        "offset": 4,
		      },
		      "end": {
		        "line": 3,
		        "offset": 13,
		      },
		      "file": "\${testWorkspacePath}/tsconfigProject/fixture.vue",
		      "isDefinition": true,
		      "isWriteAccess": true,
		      "lineText": "			const foo = 1;",
		      "start": {
		        "line": 3,
		        "offset": 10,
		      },
		    },
		    {
		      "end": {
		        "line": 7,
		        "offset": 14,
		      },
		      "file": "\${testWorkspacePath}/tsconfigProject/fixture.vue",
		      "isDefinition": false,
		      "isWriteAccess": false,
		      "lineText": "				<Foo :foo></Foo>",
		      "start": {
		        "line": 7,
		        "offset": 11,
		      },
		    },
		  ],
		  "symbolDisplayString": "const foo: 1",
		  "symbolName": "foo",
		  "symbolStartOffset": 10,
		}
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

	const res = await server.tsserver.message({
		seq: server.nextSeq(),
		command: 'references',
		arguments: {
			file: URI.parse(document.uri).fsPath,
			position: offset,
			includeDeclaration: false,
		},
	});
	expect(res.success).toBe(true);

	for (const ref of res!.body.refs) {
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
