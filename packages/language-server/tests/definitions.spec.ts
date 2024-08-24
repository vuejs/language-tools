import { Location, TextDocument } from '@volar/language-server';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server.js';

describe('Definitions', async () => {

	it('TS to vue', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await assertDefinition('tsconfigProject/fixture1.ts', 'typescript', `import C|omponent from './empty.vue';`);
		await assertDefinition('tsconfigProject/fixture2.ts', 'typescript', `import Component from '|./empty.vue';`);
	});

	it('Alias path', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await openDocument('tsconfigProject/foo.ts', 'typescript', `export const foo = 'foo';`);
		await assertDefinition('tsconfigProject/fixture.vue', 'vue', `
			<script setup lang="ts">
			import { foo| } from '@/foo';
			</script>
		`);
	});

	it('#2600', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await openDocument('tsconfigProject/foo.vue', 'vue', `
			<template>
				<h1>{{ msg }}</h1>
			</template>

			<script lang="ts">
			export default defineProps<{ msg: string }>()
			</script>
		`);
		await assertDefinition('tsconfigProject/fixture.vue', 'vue', `
			<script setup lang="ts">
			import Foo from '|@/foo.vue';
			</script>
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

	async function assertDefinition(fileName: string, languageId: string, content: string) {
		const offset = content.indexOf('|');
		expect(offset).toBeGreaterThanOrEqual(0);
		content = content.slice(0, offset) + content.slice(offset + 1);

		const server = await getLanguageServer();
		let document = await openDocument(fileName, languageId, content);

		const position = document.positionAt(offset);
		const definition = await server.sendDefinitionRequest(document.uri, position) as Location[] | null;
		expect(definition).toBeDefined();
		expect(definition!.length).greaterThan(0);

		for (const loc of definition!) {
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
