import type { TextDocument } from '@volar/language-server';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server.js';

test('Document links', async () => {
	expect(
		await requestDocumentLinks(
			'fixture.vue',
			'vue',
			`
			<script setup>
			import { useTemplateRef } from 'vue';
			const ref1 = useTemplateRef("single-ref") // Expect 1 document link to template
			const ref2 = useTemplateRef("multi-ref")  // Expect 2 document links to template
			const ref3 = useTemplateRef("for-ref")    // Expect 1 document link to template
			const ref4 = useTemplateRef("broken-ref") // Expect 0 document links to template
			</script>

			<template>
				<div class="myclass">Expect one document link to style</div>
				<div ref="single-ref"></div>
				<div ref="multi-ref"></div>
				<span ref="multi-ref"></span>
				<div v-for="x of [1, 2, 3]" ref="for-ref">{{ x }}</div>
			</template>

			<style scoped>
			.myclass {
				color: red;
			}
			</style>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  {
		    "range": {
		      "end": {
		        "character": 42,
		        "line": 3,
		      },
		      "start": {
		        "character": 32,
		        "line": 3,
		      },
		    },
		    "target": "file://\${testWorkspacePath}/fixture.vue#L12%2C15-L12%2C25",
		  },
		  {
		    "range": {
		      "end": {
		        "character": 41,
		        "line": 4,
		      },
		      "start": {
		        "character": 32,
		        "line": 4,
		      },
		    },
		    "target": "file://\${testWorkspacePath}/fixture.vue#L13%2C15-L13%2C24",
		  },
		  {
		    "range": {
		      "end": {
		        "character": 41,
		        "line": 4,
		      },
		      "start": {
		        "character": 32,
		        "line": 4,
		      },
		    },
		    "target": "file://\${testWorkspacePath}/fixture.vue#L14%2C16-L14%2C25",
		  },
		  {
		    "range": {
		      "end": {
		        "character": 39,
		        "line": 5,
		      },
		      "start": {
		        "character": 32,
		        "line": 5,
		      },
		    },
		    "target": "file://\${testWorkspacePath}/fixture.vue#L15%2C38-L15%2C45",
		  },
		  {
		    "range": {
		      "end": {
		        "character": 23,
		        "line": 10,
		      },
		      "start": {
		        "character": 16,
		        "line": 10,
		      },
		    },
		    "target": "file://\${testWorkspacePath}/fixture.vue#L19%2C4-L19%2C12",
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

async function requestDocumentLinks(fileName: string, languageId: string, content: string) {
	const server = await getLanguageServer();
	let document = await prepareDocument(fileName, languageId, content);

	const documentLinks = await server.vueserver.sendDocumentLinkRequest(document.uri);
	expect(documentLinks).toBeDefined();
	expect(documentLinks!.length).greaterThan(0);

	for (const documentLink of documentLinks!) {
		documentLink.target = 'file://${testWorkspacePath}'
			+ documentLink.target!.slice(URI.file(testWorkspacePath).toString().length);
	}

	return documentLinks!;
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
