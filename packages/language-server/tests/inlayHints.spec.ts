import { TextDocument } from '@volar/language-server';
import { afterEach, describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server.js';

describe('Definitions', async () => {

	it('Inline handler leading', async () => {
		expect(
			await requestInlayHintsResult('tsconfigProject/fixture.vue', 'vue', `
				<script setup lang="ts">
				let a = 0;
				</script>

				<template>
					<div @click="a = 1"></div>
				</template>
			`)
		).toMatchInlineSnapshot(`
			"
							<script setup lang="ts">
							let a = 0;
							</script>

							<template>
								<div @click="/* $event => */a = 1"></div>
							</template>
						"
		`);
	});

	it('Missing props', async () => {
		prepareDocument('tsconfigProject/foo.vue', 'vue', `
			<script setup lang="ts">
			defineProps<{
				foo: number;
			}>();
			</script>
		`);
		expect(
			await requestInlayHintsResult('tsconfigProject/fixture.vue', 'vue', `
				<script setup lang="ts">
				import Foo from './foo.vue';
				</script>

				<template>
					<Foo></Foo>
				</template>
			`)
		).toMatchInlineSnapshot(`
			"
							<script setup lang="ts">
							import Foo from './foo.vue';
							</script>

							<template>
								<Foo/* foo! */></Foo>
							</template>
						"
		`);
	});

	it('Options wrapper', async () => {
		expect(
			await requestInlayHintsResult('tsconfigProject/fixture.vue', 'vue', `
				<script>
				export default {};
				</script>
			`)
		).toMatchInlineSnapshot(`
			"
							<script>
							export default /* (await import('vue')).defineComponent( */{}/* ) */;
							</script>
						"
		`);
	});

	it('Destructured props', async () => {
		expect(
			await requestInlayHintsResult('tsconfigProject/fixture.vue', 'vue', `
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
			`)
		).toMatchInlineSnapshot(`
			"
							<script setup lang="ts">
							import { watch } from 'vue';

							const { foo, bar, ...props } = defineProps<{
								foo: string;
								bar: string;
								baz: string;
							}>();

							type foo = foo[string] & typeof /* props. */foo;

							interface foo extends (typeof /* props. */foo) {
								foo: string;
								foo(foo: string): void;
								foo: (foo: string) => void;
							}

							const obj = {
								foo: /* props. */foo,
								[/* props. */foo]: '',
								foo/* : props.foo */,
								foo(foo) { },
								foo: function (foo) { },
								get bar() { return this.foo; },
								set bar(val) { this.foo = val; }
							};

							function func(foo) { }

							class cls {
								foo: string = /* props. */foo;
								constructor(foo) { }
							}

							for (const char of /* props. */foo) { }

							try { } catch (foo) { }

							watch(() => /* props. */foo, (foo) => {
								console.log(foo, /* props. */bar, props.baz);
							});
							</script>
						"
		`);
	});

	it('#4720', async () => {
		expect(
			await requestInlayHintsResult('fixture.vue', 'vue', `
				<template>
					<div :foo.attr></div>
				</template>
			`)
		).toMatchInlineSnapshot(`
			"
							<template>
								<div :foo.attr/* ="foo" */></div>
							</template>
						"
		`);
	});

	it('#4855', async () => {
		expect(
			await requestInlayHintsResult('fixture.vue', 'vue', `
				<script setup lang="ts">
				import { toString } from './utils';

				const { foo } = defineProps<{ foo: string }>();
				console.log(foo);
				</script>
			`)
		).toMatchInlineSnapshot(`
			"
							<script setup lang="ts">
							import { toString } from './utils';

							const { foo } = defineProps<{ foo: string }>();
							console.log(/* props. */foo);
							</script>
						"
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

	async function requestInlayHintsResult(fileName: string, languageId: string, content: string) {
		const server = await getLanguageServer();
		let document = await prepareDocument(fileName, languageId, content);

		const inlayHints = await server.sendInlayHintRequest(document.uri, { start: document.positionAt(0), end: document.positionAt(content.length) });
		expect(inlayHints).toBeDefined();
		expect(inlayHints!.length).greaterThan(0);

		let text = document.getText();
		for (const hint of inlayHints!.sort((a, b) => document.offsetAt(b.position) - document.offsetAt(a.position))) {
			const offset = document.offsetAt(hint.position);
			text = text.slice(0, offset) + '/* ' + hint.label + ' */' + text.slice(offset);
		}

		return text;
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
