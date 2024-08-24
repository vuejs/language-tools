import { InsertReplaceEdit, TextDocument, TextEdit } from '@volar/language-server';
import { afterEach, describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server.js';

describe('Completions', async () => {

	it('Directives', async () => {
		await assertCompletion('fixture.vue', 'vue', `<template><div v-ht|></div></template>`, 'v-html');
		await assertCompletion('fixture.vue', 'vue', `<template><div v-cl|></div></template>`, 'v-cloak');
		await assertCompletion('fixture.vue', 'vue', `<template><div v-el|></div></template>`, 'v-else');
		await assertCompletion('fixture.vue', 'vue', `<template><div v-p|></div></template>`, 'v-pre');
	});

	it('$event argument', async () => {
		await assertCompletion('fixture.vue', 'vue', `<template><div @click="console.log($eve|)"></div></template>`, '$event');
	});

	it('<script setup>', async () => {
		await assertCompletion('fixture.vue', 'vue', `
			<template>{{ f| }}</template>

			<script lang="ts" setup>
			const foo = 1;
			</script>
		`, 'foo');
	});

	it('Slot name', async () => {
		await assertCompletion('fixture.vue', 'vue', `
			<template>
				<Foo>
					<template #|></template>
				</Foo>
			</template>

			<script lang="ts" setup>
			let Foo: new () => {
				$slots: {
					default: any;
				};
			};
			</script>
		`, 'default');
	});

	it('#2454', async () => {
		await assertCompletion('fixture.vue', 'vue', `
			<script setup lang="ts">
			let vLoading: any;
			</script>

			<template>
			<div v-load|="vLoading"></div>
			</template>
		`, 'v-loading');
	});

	it('#2511', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await openDocument('tsconfigProject/component-for-auto-import.vue', 'vue', `<script setup lang="ts"></script>`);
		await assertCompletion('tsconfigProject/fixture.vue', 'vue', `
			<script setup lang="ts">
			import componentFor|
			</script>
		`, 'ComponentForAutoImport');
	});

	it('#3658', async () => {
		await assertCompletion('fixture.vue', 'vue', `
			<template>
				<Comp>
					<template #foo="foo">
						{{ fo| }}
					</template>
				</Comp>
			</template>
		`, 'foo');
	});

	it('#4639', async () => {
		await assertCompletion('fixture.vue', 'vue', `
			<template>
				<div @click.| />
			</template>
		`, 'capture');
	});

	it('Alias path', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await assertCompletion('tsconfigProject/fixture.vue', 'vue', `
			<script setup lang="ts">
			import Component from '@/|';
			</script>
		`, 'empty.vue');
	});

	it('Relative path', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await assertCompletion('tsconfigProject/fixture.vue', 'vue', `
			<script setup lang="ts">
			import Component from './|';
			</script>
		`, 'empty.vue');
	});

	it('Component auto import', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await openDocument('tsconfigProject/ComponentForAutoImport.vue', 'vue', `<script setup lang="ts"></script>`);
		await assertCompletion('tsconfigProject/fixture.vue', 'vue', `
			<script setup lang="ts">
			</script>

			<template>
				<ComponentForA| />
			</template>
		`, 'ComponentForAutoImport');
	});

	it('core#8811', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await assertCompletion('tsconfigProject/fixture.vue', 'vue', `
			<script setup lang="ts">
			declare const Foo: new () => {
				$props: {
					FooBar: string;
				};
			};
			</script>

			<template>
				<Foo :-| ></Foo>
			</template>
		`, ':-foo-bar');
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

	async function assertCompletion(fileName: string, languageId: string, content: string, itemLabel: string) {
		const offset = content.indexOf('|');
		content = content.slice(0, offset) + content.slice(offset + 1);

		const server = await getLanguageServer();
		let document = await openDocument(fileName, languageId, content);

		const position = document.positionAt(offset);
		const completions = await server.sendCompletionRequest(document.uri, position);

		let completion = completions?.items.find(item => item.label === itemLabel);
		expect(completion).toBeDefined();

		completion = await server.sendCompletionResolveRequest(completion!);
		expect(completion).toBeDefined();

		const edits: TextEdit[] = [];

		if (completion.textEdit) {
			if (InsertReplaceEdit.is(completion.textEdit)) {
				edits.push({ newText: completion.textEdit.newText, range: completion.textEdit.replace });
			}
			else {
				edits.push(completion.textEdit);
			}
		}
		else {
			edits.push({
				newText: completion.insertText ?? completion.label,
				range: { start: position, end: position },
			});
		}
		if (completion.additionalTextEdits) {
			edits.push(...completion.additionalTextEdits);
		}
		if (edits.length === 0) {
			console.log(completion);
		}
		expect(edits.length).toBeGreaterThan(0);

		document = await server.updateTextDocument(document.uri, edits);

		expect(document.getText()).toMatchSnapshot();
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
