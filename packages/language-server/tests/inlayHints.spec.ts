import { TextDocument } from '@volar/language-server';
import { afterEach, describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server.js';

describe('Definitions', async () => {

	it('Inline handler leading', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await assertInlayHints('tsconfigProject/fixture.vue', 'vue', `
			<script setup lang="ts">
			let a = 0;
			</script>

			<template>
				<div @click="a = 1"></div>
			</template>
		`);
	});

	it('Missing props', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		openDocument('tsconfigProject/foo.vue', 'vue', `
			<script setup lang="ts">
			defineProps<{
				foo: number;
			}>();
			</script>
		`);
		await assertInlayHints('tsconfigProject/fixture.vue', 'vue', `
			<script setup lang="ts">
			import Foo from './foo.vue';
			</script>

			<template>
				<Foo></Foo>
			</template>
		`);
	});

	it('Options wrapper', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await assertInlayHints('tsconfigProject/fixture.vue', 'vue', `
			<script>
			export default {};
			</script>
		`);
	});

	it('Destructured props', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await assertInlayHints('tsconfigProject/fixture.vue', 'vue', `
			<script setup lang="ts">
			import { watch } from 'vue';

			const { foo, bar, ...props } = defineProps<{
				foo: string;
				bar: string;
				baz: string;
			}>();

			type foo = foo[string] & typeof foo;

			interface foo extends (typeof foo) {
				foo: string;
				foo(foo: string): void;
				foo: (foo: string) => void;
			}

			const obj = {
				foo: foo,
				[foo]: '',
				foo,
				foo(foo) { },
				foo: function (foo) { },
				get bar() { return this.foo; },
				set bar(val) { this.foo = val; }
			};

			function func(foo) { }

			class cls {
				foo: string = foo;
				constructor(foo) { }
			}

			for (const char of foo) { }

			try { } catch (foo) { }

			watch(() => foo, (foo) => {
				console.log(foo, bar, props.baz);
			});
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

	async function assertInlayHints(fileName: string, languageId: string, content: string) {
		const server = await getLanguageServer();
		let document = await openDocument(fileName, languageId, content);

		const inlayHints = await server.sendInlayHintRequest(document.uri, { start: document.positionAt(0), end: document.positionAt(content.length) });
		expect(inlayHints).toBeDefined();
		expect(inlayHints!.length).greaterThan(0);

		let text = document.getText();
		for (const hint of inlayHints!.sort((a, b) => document.offsetAt(b.position) - document.offsetAt(a.position))) {
			const offset = document.offsetAt(hint.position);
			text = text.slice(0, offset) + '[' + hint.label + ']' + text.slice(offset);
		}

		expect(text).toMatchSnapshot();
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
