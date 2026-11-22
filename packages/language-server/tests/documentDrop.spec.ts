import { DocumentDropRequest, type TextDocument } from '@volar/language-server';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

test('Add dropped component to existing components option', async () => {
	expect(
		await requestDocumentDrop(
			'tsconfigProject/fixture.vue',
			`
			<script lang="ts">
			import { defineComponent } from 'vue';
			import Foo from './foo.vue';

			export default defineComponent({
				components: { Foo },
			});
			</script>

			<template><div>|</div></template>
			`,
			'tsconfigProject/empty.vue',
		),
	).toMatchInlineSnapshot(`
		{
		  "additionalEdit": {
		    "changes": {
		      "file://\${testWorkspacePath}/tsconfigProject/fixture.vue": [
		        {
		          "newText": "
		import Empty from './empty.vue'",
		          "range": {
		            "end": {
		              "character": 31,
		              "line": 3,
		            },
		            "start": {
		              "character": 31,
		              "line": 3,
		            },
		          },
		        },
		        {
		          "newText": "{ Foo, Empty }",
		          "range": {
		            "end": {
		              "character": 23,
		              "line": 6,
		            },
		            "start": {
		              "character": 16,
		              "line": 6,
		            },
		          },
		        },
		      ],
		    },
		  },
		  "insertText": "<Empty$0 />",
		  "insertTextFormat": 2,
		}
	`);
});

test('Add components option for dropped component', async () => {
	expect(
		await requestDocumentDrop(
			'tsconfigProject/fixture.vue',
			`
			<template><div>|</div></template>

			<script lang="ts">
			import { defineComponent } from 'vue';

			export default defineComponent({
				name: 'Fixture',
			});
			</script>
			`,
			'tsconfigProject/empty.vue',
		),
	).toMatchInlineSnapshot(`
		{
		  "additionalEdit": {
		    "changes": {
		      "file://\${testWorkspacePath}/tsconfigProject/fixture.vue": [
		        {
		          "newText": "
		import Empty from './empty.vue'",
		          "range": {
		            "end": {
		              "character": 41,
		              "line": 4,
		            },
		            "start": {
		              "character": 41,
		              "line": 4,
		            },
		          },
		        },
		        {
		          "newText": "{
		    name: "Fixture",
		    components: { Empty }
		}",
		          "range": {
		            "end": {
		              "character": 4,
		              "line": 8,
		            },
		            "start": {
		              "character": 34,
		              "line": 6,
		            },
		          },
		        },
		      ],
		    },
		  },
		  "insertText": "<Empty$0 />",
		  "insertTextFormat": 2,
		}
	`);
});

test('Add components option for dropped component with script setup', async () => {
	expect(
		await requestDocumentDrop(
			'tsconfigProject/fixture.vue',
			`
			<script lang="ts">
			export default {
				inheritAttrs: false,
			};
			</script>

			<script setup lang="ts">
			import { ref } from 'vue';
			const count = ref(0);
			</script>

			<template><div>|</div></template>
			`,
			'tsconfigProject/empty.vue',
		),
	).toMatchInlineSnapshot(`
		{
		  "additionalEdit": {
		    "changes": {
		      "file://\${testWorkspacePath}/tsconfigProject/fixture.vue": [
		        {
		          "newText": "
		import Empty from './empty.vue'",
		          "range": {
		            "end": {
		              "character": 29,
		              "line": 8,
		            },
		            "start": {
		              "character": 29,
		              "line": 8,
		            },
		          },
		        },
		        {
		          "newText": "{
		    inheritAttrs: false,
		    components: { Empty }
		}",
		          "range": {
		            "end": {
		              "character": 4,
		              "line": 4,
		            },
		            "start": {
		              "character": 18,
		              "line": 2,
		            },
		          },
		        },
		      ],
		    },
		  },
		  "insertText": "<Empty$0 />",
		  "insertTextFormat": 2,
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

async function requestDocumentDrop(fileName: string, content: string, droppedFileName: string) {
	const offset = content.indexOf('|');
	expect(offset).toBeGreaterThanOrEqual(0);
	content = content.slice(0, offset) + content.slice(offset + 1);

	const server = await getLanguageServer();
	const document = await prepareDocument(fileName, 'vue', content);

	const edit = await server.vueserver.connection.sendRequest(DocumentDropRequest.type, {
		textDocument: { uri: document.uri },
		position: document.positionAt(offset),
		dataTransfer: [{
			mimeType: 'text/uri-list',
			value: URI.file(`${testWorkspacePath}/${droppedFileName}`).toString(),
		}],
	});
	expect(edit?.additionalEdit?.changes).toBeDefined();

	for (const [uri, edits] of Object.entries(edit!.additionalEdit!.changes!)) {
		delete edit!.additionalEdit!.changes![uri];
		edit!.additionalEdit!
			.changes!['file://${testWorkspacePath}' + uri.slice(URI.file(testWorkspacePath).toString().length)] = edits;
	}

	return edit;
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
