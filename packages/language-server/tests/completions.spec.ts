import { TextDocument } from '@volar/language-server';
import { afterEach, describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server.js';

describe('Completions', async () => {

	it('Vue tags', async () => {
		expect(
			(await requestCompletionList('fixture.vue', 'vue', `<|`)).items.map(item => item.label)
		).toMatchInlineSnapshot(`
			[
			  "template",
			  "script",
			  "script setup",
			  "style",
			  "script lang="ts"",
			  "script lang="js"",
			  "script lang="tsx"",
			  "script lang="jsx"",
			  "script setup lang="ts"",
			  "script setup lang="js"",
			  "script setup lang="tsx"",
			  "script setup lang="jsx"",
			  "style lang="css"",
			  "style lang="css" scoped",
			  "style lang="css" module",
			  "style lang="scss"",
			  "style lang="scss" scoped",
			  "style lang="scss" module",
			  "style lang="less"",
			  "style lang="less" scoped",
			  "style lang="less" module",
			  "style lang="stylus"",
			  "style lang="stylus" scoped",
			  "style lang="stylus" module",
			  "style lang="postcss"",
			  "style lang="postcss" scoped",
			  "style lang="postcss" module",
			  "style lang="sass"",
			  "style lang="sass" scoped",
			  "style lang="sass" module",
			  "template lang="pug"",
			]
		`);
	});

	it('#4670', async () => {
		expect(
			(await requestCompletionList('fixture.vue', 'vue', `<template><div click| /></template>`)).items.map(item => item.label).filter(label => label.includes('click'))
		).toMatchInlineSnapshot(`
			[
			  "onclick",
			  "ondblclick",
			  "v-on:auxclick",
			  "@auxclick",
			  "v-on:click",
			  "@click",
			  "v-on:dblclick",
			  "@dblclick",
			]
		`);
	});

	it('HTML tags and built-in components', async () => {
		expect(
			(await requestCompletionList('fixture.vue', 'vue', `<template><| /></template>`)).items.map(item => item.label)
		).toMatchInlineSnapshot(`
			[
			  "!DOCTYPE",
			  "html",
			  "head",
			  "title",
			  "base",
			  "link",
			  "meta",
			  "style",
			  "body",
			  "article",
			  "section",
			  "nav",
			  "aside",
			  "h1",
			  "h2",
			  "h3",
			  "h4",
			  "h5",
			  "h6",
			  "header",
			  "footer",
			  "address",
			  "p",
			  "hr",
			  "pre",
			  "blockquote",
			  "ol",
			  "ul",
			  "li",
			  "dl",
			  "dt",
			  "dd",
			  "figure",
			  "figcaption",
			  "main",
			  "div",
			  "a",
			  "em",
			  "strong",
			  "small",
			  "s",
			  "cite",
			  "q",
			  "dfn",
			  "abbr",
			  "ruby",
			  "rb",
			  "rt",
			  "rp",
			  "time",
			  "code",
			  "var",
			  "samp",
			  "kbd",
			  "sub",
			  "sup",
			  "i",
			  "b",
			  "u",
			  "mark",
			  "bdi",
			  "bdo",
			  "span",
			  "br",
			  "wbr",
			  "ins",
			  "del",
			  "picture",
			  "img",
			  "iframe",
			  "embed",
			  "object",
			  "param",
			  "video",
			  "audio",
			  "source",
			  "track",
			  "map",
			  "area",
			  "table",
			  "caption",
			  "colgroup",
			  "col",
			  "tbody",
			  "thead",
			  "tfoot",
			  "tr",
			  "td",
			  "th",
			  "form",
			  "label",
			  "input",
			  "button",
			  "select",
			  "datalist",
			  "optgroup",
			  "option",
			  "textarea",
			  "output",
			  "progress",
			  "meter",
			  "fieldset",
			  "legend",
			  "details",
			  "summary",
			  "dialog",
			  "script",
			  "noscript",
			  "canvas",
			  "data",
			  "hgroup",
			  "menu",
			  "Transition",
			  "TransitionGroup",
			  "KeepAlive",
			  "Teleport",
			  "Suspense",
			  "component",
			  "slot",
			  "template",
			  "fixture",
			  "BaseTransition",
			]
		`);
	});

	it('Directives', async () => {
		await requestCompletionItem('fixture.vue', 'vue', `<template><div v-ht|></div></template>`, 'v-html');
		await requestCompletionItem('fixture.vue', 'vue', `<template><div v-cl|></div></template>`, 'v-cloak');
		await requestCompletionItem('fixture.vue', 'vue', `<template><div v-el|></div></template>`, 'v-else');
		await requestCompletionItem('fixture.vue', 'vue', `<template><div v-p|></div></template>`, 'v-pre');
	});

	it('$event argument', async () => {
		await requestCompletionItem('fixture.vue', 'vue', `<template><div @click="console.log($eve|)"></div></template>`, 'event');
	});

	it('<script setup>', async () => {
		await requestCompletionItem('fixture.vue', 'vue', `
			<template>{{ f| }}</template>

			<script lang="ts" setup>
			const foo = 1;
			</script>
		`, 'foo');
	});

	it('Slot name', async () => {
		await requestCompletionItem('fixture.vue', 'vue', `
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
		await requestCompletionItem('fixture.vue', 'vue', `
			<script setup lang="ts">
			let vLoading: any;
			</script>

			<template>
			<div v-load|="vLoading"></div>
			</template>
		`, 'v-loading');
	});

	it('#2511', async () => {
		await prepareDocument('tsconfigProject/component-for-auto-import.vue', 'vue', `<script setup lang="ts"></script>`);
		expect(
			(await requestCompletionItem('tsconfigProject/fixture.vue', 'vue', `
				<script setup lang="ts">
				import componentFor|
				</script>
			`, 'ComponentForAutoImport')).textEdit
		).toMatchInlineSnapshot(`
			{
			  "newText": "import componentForAutoImport$1 from './component-for-auto-import.vue';",
			  "range": {
			    "end": {
			      "character": 23,
			      "line": 2,
			    },
			    "start": {
			      "character": 4,
			      "line": 2,
			    },
			  },
			}
		`);
	});

	it('#3658', async () => {
		await requestCompletionItem('fixture.vue', 'vue', `
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
		await requestCompletionItem('fixture.vue', 'vue', `
			<template>
				<div @click.| />
			</template>
		`, 'capture');
	});

	it('Alias path', async () => {
		await requestCompletionItem('tsconfigProject/fixture.vue', 'vue', `
			<script setup lang="ts">
			import Component from '@/|';
			</script>
		`, 'empty.vue');
	});

	it('Relative path', async () => {
		await requestCompletionItem('tsconfigProject/fixture.vue', 'vue', `
			<script setup lang="ts">
			import Component from './|';
			</script>
		`, 'empty.vue');
	});

	it('Component auto import', async () => {
		await prepareDocument('tsconfigProject/ComponentForAutoImport.vue', 'vue', `<script setup lang="ts"></script>`);
		expect(
			(await requestCompletionItem('tsconfigProject/fixture.vue', 'vue', `
				<script setup lang="ts">
				</script>

				<template>
					<ComponentForA| />
				</template>
			`, 'ComponentForAutoImport'))
		).toMatchInlineSnapshot(`
			{
			  "additionalTextEdits": [
			    {
			      "newText": "
			import ComponentForAutoImport from './ComponentForAutoImport.vue';
			",
			      "range": {
			        "end": {
			          "character": 28,
			          "line": 1,
			        },
			        "start": {
			          "character": 28,
			          "line": 1,
			        },
			      },
			    },
			  ],
			  "commitCharacters": [
			    ".",
			    ",",
			    ";",
			    "(",
			  ],
			  "detail": "Add import from "./ComponentForAutoImport.vue"
			(property) default: DefineComponent<{}, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}, string, PublicProps, ToResolvedProps<{}, {}>, ... 8 more ..., any>",
			  "documentation": {
			    "kind": "markdown",
			    "value": "",
			  },
			  "insertTextFormat": 1,
			  "kind": 5,
			  "label": "ComponentForAutoImport",
			  "labelDetails": {
			    "description": "./ComponentForAutoImport.vue",
			  },
			  "sortText": "￿16",
			  "textEdit": {
			    "newText": "ComponentForAutoImport",
			    "range": {
			      "end": {
			        "character": 19,
			        "line": 5,
			      },
			      "start": {
			        "character": 6,
			        "line": 5,
			      },
			    },
			  },
			}
		`);
	});

	it('core#8811', async () => {
		await requestCompletionItem('tsconfigProject/fixture.vue', 'vue', `
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

	it('#4796', async () => {
		expect(
			(await requestCompletionItem('tsconfigProject/fixture.vue', 'vue', `
				<template>
					<HelloWorld :msg| />
				</template>

				<script lang="ts" setup>
				import { defineComponent } from 'vue';

				const HelloWorld = defineComponent({
					props: {
						/**
						 * The message to display
						 */
						msg: String
					}
				})
				</script>
			`, ':msg'))
		).toMatchInlineSnapshot(`
			{
			  "documentation": {
			    "kind": "markdown",
			    "value": "The message to display",
			  },
			  "insertTextFormat": 2,
			  "kind": 5,
			  "label": ":msg",
			  "sortText": "  :msg",
			  "textEdit": {
			    "newText": ":msg="$1"",
			    "range": {
			      "end": {
			        "character": 21,
			        "line": 2,
			      },
			      "start": {
			        "character": 17,
			        "line": 2,
			      },
			    },
			  },
			}
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

	async function requestCompletionItem(fileName: string, languageId: string, content: string, itemLabel: string) {
		const completions = await requestCompletionList(fileName, languageId, content);
		let completion = completions.items.find(item => item.label === itemLabel);
		expect(completion).toBeDefined();
		if (completion!.data) {
			const server = await getLanguageServer();
			completion = await server.sendCompletionResolveRequest(completion!);
			expect(completion).toBeDefined();
		}
		return completion!;
	}

	async function requestCompletionList(fileName: string, languageId: string, content: string) {
		const offset = content.indexOf('|');
		expect(offset).toBeGreaterThanOrEqual(0);
		content = content.slice(0, offset) + content.slice(offset + 1);

		const server = await getLanguageServer();
		let document = await prepareDocument(fileName, languageId, content);

		const position = document.positionAt(offset);
		const completions = await server.sendCompletionRequest(document.uri, position);
		expect(completions).toBeDefined();

		return completions!;
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
