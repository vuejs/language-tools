import { TextDocument } from '@volar/language-server';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server.js';

describe('Definitions', async () => {

	it('Default slot', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await openDocument('tsconfigProject/foo.vue', 'vue', `
			<script setup lang="ts">
			import Fixture from './fixture.vue';
			</script>

			<template>
				<Fixture>
					<div></div>
				</Fixture>
			</template>
		`);
		await assertReferences('tsconfigProject/fixture.vue', 'vue', `
			<template>
				<slot|></slot>
			</template>
		`);
	});

	it('Named slot', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await openDocument('tsconfigProject/foo.vue', 'vue', `
			<script setup lang="ts">
			import Fixture from './fixture.vue';
			</script>

			<template>
				<Fixture #foo></Fixture>
			</template>
		`);
		await assertReferences('tsconfigProject/fixture.vue', 'vue', `
			<template>
				<slot name="|foo"></slot>
			</template>
		`);
	});

	it('v-bind shorthand', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await assertReferences('tsconfigProject/fixture.vue', 'vue', `
			<script setup lang="ts">
			const |foo = 1;
			</script>

			<template>
				<Foo :foo></Foo>
			</template>
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

	/**
	 * @deprecated Remove this when #4717 fixed.
	 */
	async function ensureGlobalTypesHolder(folderName: string) {
		const document = await openDocument(`${folderName}/globalTypesHolder.vue`, 'vue', '');
		const server = await getLanguageServer();
		await server.sendDocumentDiagnosticRequest(document.uri);
	}

	async function assertReferences(fileName: string, languageId: string, content: string) {
		const offset = content.indexOf('|');
		content = content.slice(0, offset) + content.slice(offset + 1);

		const server = await getLanguageServer();
		let document = await openDocument(fileName, languageId, content);

		const position = document.positionAt(offset);
		const references = await server.sendReferencesRequest(document.uri, position, { includeDeclaration: false });
		expect(references).toBeDefined();
		expect(references!.length).greaterThan(0);

		for (const loc of references!) {
			expect(path.relative(testWorkspacePath, URI.parse(loc.uri).fsPath)).toMatchSnapshot();
			expect(loc.range).toMatchSnapshot();
		}
	}

	async function openDocument(fileName: string, languageId: string, content: string) {
		const server = await getLanguageServer();
		const uri = URI.file(`${testWorkspacePath}/${fileName}`);
		const document = await server.openInMemoryDocument(uri.toString(), languageId, content);
		if (openedDocuments.every(d => d.uri !== document.uri)) {
			openedDocuments.push(document);
		}
		return document;
	}
});
