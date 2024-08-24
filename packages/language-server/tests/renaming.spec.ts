import { TextDocument } from '@volar/language-server';
import { afterEach, describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import * as path from 'path';
import { getLanguageServer, testWorkspacePath } from './server.js';

describe('Renaming', async () => {

	it('#2410', async () => {
		await assertRenaming('fixture.vue', 'vue', `<template><|h1></h1></template>`, 'h2');
		await assertRenaming('fixture.vue', 'vue', `<template><h1|></h1></template>`, 'h2');
	});

	it('CSS', async () => {
		await assertRenaming('fixture.vue', 'vue', `
			<template>
				<div :class="$style.foo|"></div>
			</template>

			<style module>
			/* .foo { } */
			.foo { }
			</style>

			<style module lang="scss">
			// .foo { }
			</style>
		`, 'bar');
		await assertRenaming('fixture.vue', 'vue', `
			<template>
				<div class="foo|"></div>
			</template>

			<style scoped>
			.foo { }
			</style>
		`, 'bar');
		await assertRenaming('fixture.vue', 'vue', `
			<script lang="ts" setup>
			const foo = 1;
			</script>

			<style>
			/* .bar { color: v-bind(foo); } */
			.bar { color: v-bind(foo|); }
			.bar { color: v-bind('foo'); }
			.bar { color: v-bind("foo"); }
			.bar { color: v-bind(foo + foo); }
			.bar { color: v-bind('foo + foo'); }
			.bar { color: v-bind("foo + foo"); }
			.bar { color: v-bind(); }
			</style>

			<style lang="scss">
			// .bar { color: v-bind(foo); }
			</style>
		`, 'bar');
	});

	it('Component props', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await openDocument('tsconfigProject/foo.vue', 'vue', `
			<template>
				<Comp :aaa-bbb="'foo'"></Comp>
				<Comp :aaaBbb="'foo'"></Comp>
			</template>

			<script lang="ts" setup>
			import Comp from './fixture.vue';
			</script>
		`);
		await assertRenaming('tsconfigProject/fixture.vue', 'vue', `
			<template>
				{{ aaaBbb }}
			</template>

			<script lang="ts" setup>
			defineProps({ aaaBbb|: String });
			</script>
		`, 'cccDdd');
	});

	it('Component type props', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await openDocument('tsconfigProject/foo.vue', 'vue', `
			<template>
				<Comp :aaa-bbb="'foo'"></Comp>
				<Comp :aaaBbb="'foo'"></Comp>
			</template>

			<script lang="ts" setup>
			import Comp from './fixture.vue';
			</script>
		`);
		await assertRenaming('tsconfigProject/fixture.vue', 'vue', `
			<template>
				{{ aaaBbb }}
			</template>

			<script lang="ts" setup>
			defineProps<{ aaaBbb|: String }>();
			</script>
		`, 'cccDdd');
	});

	it('Component dynamic props', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await assertRenaming('tsconfigProject/fixture.vue', 'vue', `
			<template>
				<div :[foo|]="123"></div>
			</template>

			<script lang="ts" setup>
			const foo = 'foo';
			</script>
		`, 'bar');
	});

	it('Component returns', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await assertRenaming('tsconfigProject/fixture.vue', 'vue', `
			<template>
				{{ foo| }}
			</template>

			<script lang="ts">
			import { defineComponent } from 'vue';

			export default defineComponent({
				setup() {
					return {
						foo: 1,
					};
				},
			});
			</script>
		`, 'bar');
	});

	it('<script setup>', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await assertRenaming('tsconfigProject/fixture.vue', 'vue', `
			<template>
				{{ foo| }}
			</template>

			<script lang="ts" setup>
			const foo = 1;
			</script>
		`, 'bar');
	});

	it('Component tags', async () => {
		await ensureGlobalTypesHolder('tsconfigProject');
		await assertRenaming('tsconfigProject/fixture.vue', 'vue', `
			<template>
				<AaBb></AaBb>
				<aa-bb></aa-bb>
			</template>

			<script lang="ts" setup>
			import AaBb| from './empty.vue';
			</script>
		`, 'CcDd');
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

	async function assertRenaming(fileName: string, languageId: string, _content: string, newName: string) {
		const offset = _content.indexOf('|');
		expect(offset).toBeGreaterThanOrEqual(0);
		const content = _content.slice(0, offset) + _content.slice(offset + 1);

		const server = await getLanguageServer();
		let document = await openDocument(fileName, languageId, content);

		const position = document.positionAt(offset);
		const edit = await server.sendRenameRequest(document.uri, position, newName);
		expect(edit).toBeDefined();
		expect(edit?.changes).toBeDefined();

		for (const [uri, edits] of Object.entries(edit!.changes!)) {
			expect(path.relative(testWorkspacePath, URI.parse(uri).fsPath)).toMatchSnapshot();
			expect(edits).toMatchSnapshot();
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
