import type { CompletionItem, CompletionItemKind, TextDocument } from '@volar/language-server';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

test('Vue tags', async () => {
	expect(
		(await requestCompletionListToVueServer('fixture.vue', 'vue', `<|`)).items.map(item => item.label),
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

test('#4670', async () => {
	expect(
		(await requestCompletionListToVueServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`<template><div click| /></template>`,
		))
			.items.map(item => item.label)
			.filter(label => label.includes('click')),
	).toMatchInlineSnapshot(`
		[
		  "@dblclick",
		  "v-on:dblclick",
		  "@auxclick",
		  "v-on:auxclick",
		  "@click",
		  "v-on:click",
		]
	`);
});

test('HTML tags and built-in components', async () => {
	expect(
		(await requestCompletionListToVueServer('tsconfigProject/empty.vue', 'vue', `<template><| /></template>`)).items
			.map(item => item.label),
	).toMatchInlineSnapshot(`
		[
		  "!DOCTYPE",
		  "Teleport",
		  "Suspense",
		  "KeepAlive",
		  "BaseTransition",
		  "Transition",
		  "TransitionGroup",
		  "Empty",
		  "a",
		  "abbr",
		  "address",
		  "area",
		  "article",
		  "aside",
		  "audio",
		  "b",
		  "base",
		  "bdi",
		  "bdo",
		  "blockquote",
		  "body",
		  "br",
		  "button",
		  "canvas",
		  "caption",
		  "cite",
		  "code",
		  "col",
		  "colgroup",
		  "data",
		  "datalist",
		  "dd",
		  "del",
		  "details",
		  "dfn",
		  "dialog",
		  "div",
		  "dl",
		  "dt",
		  "em",
		  "embed",
		  "fieldset",
		  "figcaption",
		  "figure",
		  "footer",
		  "form",
		  "h1",
		  "h2",
		  "h3",
		  "h4",
		  "h5",
		  "h6",
		  "head",
		  "header",
		  "hgroup",
		  "hr",
		  "html",
		  "i",
		  "iframe",
		  "img",
		  "input",
		  "ins",
		  "kbd",
		  "keygen",
		  "label",
		  "legend",
		  "li",
		  "link",
		  "main",
		  "map",
		  "mark",
		  "menu",
		  "meta",
		  "meter",
		  "nav",
		  "noindex",
		  "noscript",
		  "object",
		  "ol",
		  "optgroup",
		  "option",
		  "output",
		  "p",
		  "param",
		  "picture",
		  "pre",
		  "progress",
		  "q",
		  "rp",
		  "rt",
		  "ruby",
		  "s",
		  "samp",
		  "script",
		  "section",
		  "select",
		  "small",
		  "source",
		  "span",
		  "strong",
		  "style",
		  "sub",
		  "summary",
		  "sup",
		  "table",
		  "template",
		  "tbody",
		  "td",
		  "textarea",
		  "tfoot",
		  "th",
		  "thead",
		  "time",
		  "title",
		  "tr",
		  "track",
		  "u",
		  "ul",
		  "var",
		  "video",
		  "wbr",
		  "webview",
		  "svg",
		  "animate",
		  "animateMotion",
		  "animateTransform",
		  "circle",
		  "clipPath",
		  "defs",
		  "desc",
		  "ellipse",
		  "feBlend",
		  "feColorMatrix",
		  "feComponentTransfer",
		  "feComposite",
		  "feConvolveMatrix",
		  "feDiffuseLighting",
		  "feDisplacementMap",
		  "feDistantLight",
		  "feDropShadow",
		  "feFlood",
		  "feFuncA",
		  "feFuncB",
		  "feFuncG",
		  "feFuncR",
		  "feGaussianBlur",
		  "feImage",
		  "feMerge",
		  "feMergeNode",
		  "feMorphology",
		  "feOffset",
		  "fePointLight",
		  "feSpecularLighting",
		  "feSpotLight",
		  "feTile",
		  "feTurbulence",
		  "filter",
		  "foreignObject",
		  "g",
		  "image",
		  "line",
		  "linearGradient",
		  "marker",
		  "mask",
		  "metadata",
		  "mpath",
		  "path",
		  "pattern",
		  "polygon",
		  "polyline",
		  "radialGradient",
		  "rect",
		  "set",
		  "stop",
		  "switch",
		  "symbol",
		  "text",
		  "textPath",
		  "tspan",
		  "use",
		  "view",
		  "component",
		  "slot",
		  "Comp",
		  "Fixture",
		]
	`);
});

test('Auto import components exported from .vue and .ts files', async () => {
	const content = `<script setup lang="ts">\nconst a = 1;\n</script>\n\n<template><| /></template>`;
	expect(await applyCompletionItem('tsconfigProject/fixture.vue', content, 'Empty')).toBe(
		`<script setup lang="ts">\nimport Empty from './empty.vue';\n\nconst a = 1;\n</script>\n\n<template><Empty /></template>`,
	);
	expect(await applyCompletionItem('tsconfigProject/fixture.vue', content, 'Comp')).toBe(
		`<script setup lang="ts">\nimport { Comp } from './comp';\n\nconst a = 1;\n</script>\n\n<template><Comp /></template>`,
	);
});

test('Auto import components into a JS script setup', async () => {
	expect(
		await applyCompletionItem(
			'tsconfigProject/fixture.vue',
			`<script setup>\nconst a = 1;\n</script>\n\n<template><| /></template>`,
			'Comp',
		),
	).toBe(`<script setup>\nimport { Comp } from './comp';\n\nconst a = 1;\n</script>\n\n<template><Comp /></template>`);
});

test('Auto import picks up the components another file changes', async () => {
	const getLabels = async () =>
		(await requestCompletionListToVueServer('tsconfigProject/fixture.vue', 'vue', `<template><| /></template>`))
			.items.map(item => item.label);
	const comp = fs.readFileSync(path.join(testWorkspacePath, 'tsconfigProject/comp.ts'), 'utf8');
	expect(await getLabels()).not.toContain('Added');
	await prepareDocument(
		'tsconfigProject/comp.ts',
		'typescript',
		`${comp}\nexport const Added = defineComponent({});\n`,
	);
	expect(await getLabels()).toContain('Added');
	await prepareDocument('tsconfigProject/comp.ts', 'typescript', comp);
	expect(await getLabels()).not.toContain('Added');
});

test('Auto import into an empty script setup', async () => {
	expect(
		await applyCompletionItem(
			'tsconfigProject/fixture.vue',
			`<script setup lang="ts"></script>\n\n<template><| /></template>`,
			'Comp',
		),
	).toBe(`<script setup lang="ts">\nimport { Comp } from './comp';\n</script>\n\n<template><Comp /></template>`);
});

test('Auto import into a Vue file without script', async () => {
	expect(await applyCompletionItem('tsconfigProject/fixture.vue', `<template><| /></template>`, 'Comp')).toBe(
		`<script setup lang="ts">\nimport { Comp } from './comp';\n</script>\n\n<template><Comp /></template>`,
	);
});

test('Boolean props', async () => {
	expect(
		await requestCompletionItemToVueServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
		<template>
			<Comp f| />
		</template>

		<script setup lang="ts">
		declare function Comp(props: { foo: boolean }): void;
		</script>
		`,
			'foo',
		),
	).toMatchInlineSnapshot(`
		{
		  "insertTextFormat": 1,
		  "kind": 12,
		  "label": "foo",
		  "textEdit": {
		    "newText": "foo",
		    "range": {
		      "end": {
		        "character": 10,
		        "line": 2,
		      },
		      "start": {
		        "character": 9,
		        "line": 2,
		      },
		    },
		  },
		}
	`);

	expect(
		await requestCompletionItemToVueServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
		<template>
			<div sty| />
		</template>
		`,
			'style',
		),
	).toMatchInlineSnapshot(`
		{
		  "command": {
		    "command": "editor.action.triggerSuggest",
		    "title": "Suggest",
		  },
		  "insertTextFormat": 1,
		  "kind": 12,
		  "label": "style",
		  "textEdit": {
		    "newText": "style="$1"",
		    "range": {
		      "end": {
		        "character": 11,
		        "line": 2,
		      },
		      "start": {
		        "character": 8,
		        "line": 2,
		      },
		    },
		  },
		}
	`);
});

test('Component props', async () => {
	const items = (await requestCompletionListToVueServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`
		<template>
			<Comp foo="" | />
		</template>

		<script setup lang="ts">
		declare const Comp: new () => {
			$props: {
				/** The foo. */
				foo?: string;
				'onUpdate:bar'?: (value: number) => void;
				onBaz?: () => void;
			};
		};
		</script>
		`,
	)).items;
	expect(items.find(item => item.label === ':foo')?.documentation).toMatchObject({ value: 'The foo.' });
	expect(items.map(item => item.label).filter(label => /bar|baz/.test(label))).toMatchInlineSnapshot(`
		[
		  "@update:bar",
		  "v-model:bar",
		  "@baz",
		]
	`);
});

test('Component props come from the component type, without inferring its type parameters', async () => {
	const items = (await requestCompletionListToVueServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`
		<template>
			<Gen :value="true" f| />
		</template>

		<script setup lang="ts">
		declare const Gen: new <T>(props: { value: T; flag?: T }) => { $props: { value: T; flag?: T } };
		</script>
		`,
	)).items;
	// not a boolean prop, as `T` stays unresolved
	expect(items.find(item => item.label === 'flag')?.textEdit?.newText).toBe('flag="$1"');
});

test('Component props of an overloaded component come from its first construct signature', async () => {
	const items = (await requestCompletionListToVueServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`
		<template>
			<Over :b="1" | />
		</template>

		<script setup lang="ts">
		declare const Over: {
			new(props: { a: string }): { $props: { a: string } };
			new(props: { b: number }): { $props: { b: number } };
		};
		</script>
		`,
	)).items;
	expect(items.some(item => item.label === ':a')).toBe(true);
	expect(items.some(item => item.label === ':b')).toBe(false);
});

test('Component props of a dynamic component', async () => {
	const items = (await requestCompletionListToVueServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`
		<template>
			<component :is="Comp" | />
		</template>

		<script setup lang="ts">
		declare const Comp: new () => { $props: { foo?: string } };
		</script>
		`,
	)).items;
	expect(items.some(item => item.label === ':foo')).toBe(true);
});

test('Element attributes', async () => {
	const content = `
		<template>
			<x-foo f| />
		</template>

		<script lang="ts">
		declare module 'vue/jsx-runtime' {
			namespace JSX {
				interface IntrinsicElements {
					'x-foo': { flag?: boolean; label?: string };
				}
			}
		}
		export default {};
		</script>
		`;
	const items = (await requestCompletionListToVueServer('tsconfigProject/fixture.vue', 'vue', content)).items;
	expect(items.find(item => item.label === 'flag')?.textEdit?.newText).toBe('flag');
	expect(items.find(item => item.label === 'label')?.textEdit?.newText).toBe('label="$1"');
});

test('Directives', async () => {
	await requestCompletionItemToVueServer('fixture.vue', 'vue', `<template><div v-ht|></div></template>`, 'v-html');
	await requestCompletionItemToVueServer('fixture.vue', 'vue', `<template><div v-cl|></div></template>`, 'v-cloak');
	await requestCompletionItemToVueServer('fixture.vue', 'vue', `<template><div v-el|></div></template>`, 'v-else');
	await requestCompletionItemToVueServer('fixture.vue', 'vue', `<template><div v-p|></div></template>`, 'v-pre');
});

test('Directive modifiers', async () => {
	expect(
		(await requestCompletionListToVueServer(
			'fixture.vue',
			'vue',
			`<template><div :foo.|></div></template>`,
		)).items.filter(item => item.label === 'camel').length,
	).toBe(1);
});

test('Directive modifiers from the TypeScript language server', async () => {
	expect(
		(await requestCompletionListToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<div v-foo.|></div>
			</template>

			<script setup lang="ts">
			let vFoo!: import('vue').FunctionDirective<any, any, 'attr' | 'prop'>;
			</script>
		`,
		)).map(item => item.label),
	).toEqual(['attr', 'prop']);
});

test('$event argument', async () => {
	await requestCompletionItemToTsServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`<template><div @click="console.log($eve|)"></div></template>`,
		'$event',
	);
});

test('<script setup>', async () => {
	await requestCompletionItemToVueServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`
		<template>{{ f| }}</template>

		<script lang="ts" setup>
		const foo = 1;
		</script>
	`,
		'foo',
	);
});

test('Template expression completion is limited to the template scope', async () => {
	const labels = (await requestCompletionListToTsServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`
		<template>
			<div v-for="item in list">
				{{ foo + item }}
				<div @click="console.log($eve|)"></div>
			</div>
		</template>

		<script lang="ts" setup>
		const foo = 1;
		const list = [1];
		</script>
	`,
	)).map(item => item.label);
	expect(labels).toEqual(expect.arrayContaining(['$event', 'item', 'list', 'foo', 'Math', 'undefined', '$props']));
	expect(labels).not.toContain('window');
	expect(labels.filter(label => label.startsWith('__VLS_'))).toEqual([]);
});

test('Template expression completion keeps unused variables reported', async () => {
	const document = await prepareDocument(
		'tsconfigProject/fixture.vue',
		'vue',
		`
		<template>
			<div v-for="(item, index) in list">{{ item }}</div>
		</template>

		<script lang="ts" setup>
		const unused = 1;
		const list = [1];
		</script>
	`,
	);
	const server = await getLanguageServer();
	const report = await server.typescript('textDocument/diagnostic', { textDocument: { uri: document.uri } });
	expect(
		(report.items as { code?: number; range: any }[])
			.filter(diagnostic => diagnostic.code === 6133)
			.map(diagnostic => document.getText(diagnostic.range)),
	).toEqual(['unused', 'index']);
});

test('Keywords at identifier starts in template expressions', async () => {
	for (
		const content of [
			`<template>{{ ty| }}</template>`,
			`<template>{{ foo + | }}</template>`,
			`<template><div :foo="a && t|"></div></template>`,
			`<template><div @click="list.map(x => |)"></div></template>`,
			`<template><div v-if="!|"></div></template>`,
			`<template><div v-for="item in l|"></div></template>`,
			`<template><div v-for="item in list">{{ item + | }}</div></template>`,
			`<template><div v-if="a"></div><div v-else-if="|"></div></template>`,
			`<template>{{ { ...| } }}</template>`,
		]
	) {
		const items = (await requestCompletionListToVueServer('fixture.vue', 'vue', content)).items
			.filter(item => item.kind === 14 satisfies typeof CompletionItemKind.Keyword);
		expect(items.map(item => item.label), content).toEqual([
			'async',
			'delete',
			'false',
			'function',
			'in',
			'instanceof',
			'new',
			'null',
			'this',
			'true',
			'typeof',
			'void',
		]);
	}
});

test('No keywords outside identifier starts in template expressions', async () => {
	for (
		const content of [
			`<template>{{ foo.| }}</template>`,
			`<template>{{ foo?.t| }}</template>`,
			`<template>{{ 'ty|' }}</template>`,
			`<template>{{ \`ty|\` }}</template>`,
			`<template>{{ 1.| }}</template>`,
			`<template><div>ty|</div></template>`,
			`<template><div t|></div></template>`,
			`<template><div title="t|"></div></template>`,
			`<template><Comp #default="|"></Comp></template>`,
		]
	) {
		const items = (await requestCompletionListToVueServer('fixture.vue', 'vue', content)).items
			.filter(item => item.label === 'typeof');
		expect(items, content).toEqual([]);
	}
});

test('Slot name', async () => {
	const completion = await requestCompletionItemToTsServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`
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
	`,
		'default',
	);
	const range = completion.textEdit && 'range' in completion.textEdit ? completion.textEdit.range : undefined;
	expect(range).toBeDefined();
	expect(range!.start).toEqual(range!.end);
});

test('Slot name (v-slot:)', async () => {
	const completion = await requestCompletionItemToTsServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`
		<template>
			<Foo>
				<template v-slot:|></template>
			</Foo>
		</template>

		<script lang="ts" setup>
		let Foo: new () => {
			$slots: {
				default: any;
			};
		};
		</script>
		`,
		'default',
	);
	const range = completion.textEdit && 'range' in completion.textEdit ? completion.textEdit.range : undefined;
	expect(range).toBeDefined();
	expect(range!.start).toEqual(range!.end);
});

test('Slot name (bare v-slot)', async () => {
	const content = `
	<template>
		<Foo v-slot|></Foo>
	</template>

	<script lang="ts" setup>
	let Foo: new () => {
		$slots: {
			default: any;
		};
	};
	</script>
	`;
	const completions = await requestCompletionListToTsServer('tsconfigProject/fixture.vue', 'vue', content);
	expect(completions?.find(item => item.label === 'default')).toBeUndefined();
});

test('Slot element name', async () => {
	for (const define of ['defineSlots', 'const slots = defineSlots']) {
		const items = (await requestCompletionListToVueServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<slot name="|" />
			</template>

			<script setup lang="ts">
			${define}<{ header(): any; footer(): any }>();
			</script>
			`,
		)).items;
		expect(items.map(item => item.label)).toEqual(expect.arrayContaining(['header', 'footer']));
	}
});

test('#2454', async () => {
	await requestCompletionItemToVueServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`
		<script setup lang="ts">
		let vLoading: any;
		</script>

		<template>
		<div v-load|="vLoading"></div>
		</template>
	`,
		'v-loading',
	);
});

test.skip('#2511', async () => {
	await prepareDocument('tsconfigProject/component-for-auto-import.vue', 'vue', `<script setup lang="ts"></script>`);
	expect(
		await requestCompletionItemToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<script setup lang="ts">
			import componentFor|
			</script>
		`,
			'ComponentForAutoImport',
		),
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

test('#3658', async () => {
	await requestCompletionItemToVueServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`
		<template>
			<Comp>
				<template #foo="foo">
					{{ fo| }}
				</template>
			</Comp>
		</template>
	`,
		'foo',
	);
});

test('#4639', async () => {
	await requestCompletionItemToVueServer(
		'fixture.vue',
		'vue',
		`
		<template>
			<div @click.| />
		</template>
	`,
		'capture',
	);
});

test('#6132', async () => {
	const item = await requestCompletionItemToVueServer(
		'fixture.vue',
		'vue',
		`
		<template>
			<div @click.|.stop />
		</template>
	`,
		'capture',
	);
	expect(item.textEdit).toMatchInlineSnapshot(`
		{
		  "newText": "capture",
		  "range": {
		    "end": {
		      "character": 15,
		      "line": 2,
		    },
		    "start": {
		      "character": 15,
		      "line": 2,
		    },
		  },
		}
	`);
});

test('Alias path', async () => {
	await requestCompletionItemToTsServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`
		<script setup lang="ts">
		import Component from '@/|';
		</script>
	`,
		'empty.vue',
	);
});

test('Relative path', async () => {
	await requestCompletionItemToTsServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`
		<script setup lang="ts">
		import Component from './|';
		</script>
	`,
		'empty.vue',
	);
});

test.skip('Component auto import', async () => {
	expect(
		await requestCompletionItemToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<Emp| />
			</template>
		`,
			'Empty',
		),
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

test('core#8811', async () => {
	await requestCompletionItemToVueServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`
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
	`,
		':-foo-bar',
	);
});

test('#4796', async () => {
	expect(
		await requestCompletionItemToVueServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
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
		`,
			':msg',
		),
	).toMatchInlineSnapshot(`
		{
		  "documentation": {
		    "kind": "plaintext",
		    "value": "The message to display",
		  },
		  "insertTextFormat": 1,
		  "kind": 5,
		  "label": ":msg",
		  "textEdit": {
		    "newText": ":msg="$1"",
		    "range": {
		      "end": {
		        "character": 20,
		        "line": 2,
		      },
		      "start": {
		        "character": 16,
		        "line": 2,
		      },
		    },
		  },
		}
	`);
});

test('Auto insert defines', async () => {
	expect(
		await requestCompletionItemToVueServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<script lang="ts" setup>
			defineProps<{
				foo: string;
			}>();
			props|
			</script>
		`,
			'props',
		),
	).toMatchInlineSnapshot(`
		{
		  "additionalTextEdits": [
		    {
		      "newText": "const props = ",
		      "range": {
		        "end": {
		          "character": 3,
		          "line": 2,
		        },
		        "start": {
		          "character": 3,
		          "line": 2,
		        },
		      },
		    },
		  ],
		  "commitCharacters": [
		    ".",
		    ",",
		    ";",
		  ],
		  "kind": 6,
		  "label": "props",
		}
	`);
});

test('Auto insert defines only in script setup', async () => {
	const content = `
<script lang="ts" setup>
defineProps<{ foo: string }>();
</script>

<script lang="ts">
props
</script>

<template>
	<div>{{ props }}</div>
</template>
`;
	for (const textBefore of ['\nprops', '{{ props']) {
		const offset = content.indexOf(textBefore) + textBefore.length;
		const completions = await requestCompletionListToVueServer(
			'tsconfigProject/fixture.vue',
			'vue',
			content.slice(0, offset) + '|' + content.slice(offset),
		);
		expect(completions.items.filter(item => item.label === 'props' && item.additionalTextEdits)).toEqual([]);
	}
});

// `testFn` is saved in `tsconfigProject/functions.ts`: TypeScript 7 can leave an export only an open document has
// out of its auto-import data, so whether it imported one would depend on the timing of the previous test's close.
test('#5847', async () => {
	const content = `
<script setup lang="ts"></script>

<template>{{ testFn| }}</template>
`;
	expect(
		await requestCompletionItemToVueServer('tsconfigProject/fixture.vue', 'vue', content, 'testFn'),
	).toMatchObject({ kind: 3, labelDetails: { description: 'functions.ts' } });
	expect(await applyCompletionItem('tsconfigProject/fixture.vue', content, 'testFn')).toMatchInlineSnapshot(`
		"
		<script setup lang="ts">
		import { testFn } from './functions';
		</script>

		<template>{{ testFn }}</template>
		"
	`);
});

test('Not-imported exports skip setup bindings of the same name', async () => {
	const content = `
<script setup lang="ts">
const testFn = 1;
</script>

<template>{{ testF| }}</template>
`;
	const items = (await requestCompletionListToVueServer('tsconfigProject/fixture.vue', 'vue', content)).items;
	expect(items.filter(item => item.label === 'testFn')).toMatchObject([{ kind: 6 }]);
	expect(
		(await requestCompletionItemToVueServer('tsconfigProject/fixture.vue', 'vue', content, 'testFn'))
			.additionalTextEdits,
	).toBeUndefined();
});

test('Setup bindings and template locals the template scope does not list complete in template expressions', async () => {
	const getItems = async (content: string) =>
		(await requestCompletionListToVueServer('tsconfigProject/fixture.vue', 'vue', content)).items;
	const script = `
<script setup lang="ts">
import { defineProps, ref } from 'vue';
const foo = ref(1);
let bar = 2;
function baz() {}
const used = 1;
const list = [1];
</script>
`;
	const content = `${script}<template>{{ used + | }}</template>`;
	expect(
		(await getItems(content))
			.filter(item => item.kind === 6 satisfies typeof CompletionItemKind.Variable)
			.map(item => item.label),
	).toEqual(['ref', 'foo', 'bar', 'baz', 'list']);
	expect(
		(await requestCompletionItemToVueServer('tsconfigProject/fixture.vue', 'vue', content, 'foo')).additionalTextEdits,
	).toBeUndefined();

	const localLabels = (await getItems(`${script}
<template>
	<div v-for="({ id }, index) in list">
		<Comp v-slot="{ row }">{{ index + | }}</Comp>
	</div>
</template>
`)).map(item => item.label);
	expect(localLabels).toEqual(expect.arrayContaining(['id', 'row', 'foo']));
	expect(localLabels).not.toContain('index');
	expect(localLabels).not.toContain('list');
	expect((await getItems(`${script}<template><div v-for="item in |"></div></template>`)).map(item => item.label))
		.not.toContain('item');

	for (
		const content of [
			`${script}<template>{{ foo.| }}</template>`,
			`${script}<template>{{ 'b|' }}</template>`,
			`${script}<template><div v-for="item in list">{{ item }}</div>{{ bar }}{{ i| }}</template>`,
		]
	) {
		const labels = (await getItems(content)).map(item => item.label);
		expect(labels.filter(label => label === 'bar' || label === 'item'), content).toEqual([]);
	}
});

test('Setup bindings complete in template expressions whatever their names', async () => {
	const labels = (await requestCompletionListToVueServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`
<script setup lang="ts">
const __VLS_foo = 1;
const used = 1;
</script>
<template>{{ used + | }}</template>
`,
	)).items
		.filter(item => item.kind === 6 satisfies typeof CompletionItemKind.Variable)
		.map(item => item.label);
	expect(labels).toEqual(['__VLS_foo']);
});

test('Setup bindings complete as components by type', async () => {
	const labels = (await requestCompletionListToVueServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`
		<script setup lang="ts">
		import { defineComponent, ref } from 'vue';
		const DefinedComp = defineComponent({});
		const SetupComp = { setup() {} };
		const RenderComp = { render() {} };
		const TemplateComp = { template: '<div />' };
		function PlainFunction() {}
		const RefValue = ref(0);
		const PrimitiveValue = 1;
		</script>

		<template><| /></template>
	`,
	)).items.map(item => item.label);
	expect(labels).toEqual(expect.arrayContaining(['DefinedComp', 'SetupComp', 'RenderComp', 'TemplateComp']));
	expect(labels).not.toContain('PlainFunction');
	expect(labels).not.toContain('RefValue');
	expect(labels).not.toContain('PrimitiveValue');
});

test('#6110', async () => {
	await requestCompletionItemToVueServer(
		'tsconfigProject/fixture.vue',
		'vue',
		`
		<script setup lang="ts">
		import { Comp } from './comp';
		</script>

		<template>
			<C|
		</template>
	`,
		'Comp',
	);
});

const openedDocuments: TextDocument[] = [];

afterEach(async () => {
	const server = await getLanguageServer();
	for (const document of openedDocuments) {
		await server.close(document.uri);
	}
	openedDocuments.length = 0;
});

async function requestCompletionItemToVueServer(
	fileName: string,
	languageId: string,
	content: string,
	itemLabel: string,
) {
	const completions = await requestCompletionListToVueServer(fileName, languageId, content);
	let completion = completions.items.find(item => item.label === itemLabel);
	expect(completion).toBeDefined();
	if (completion!.data) {
		const server = await getLanguageServer();
		completion = await server.vueserver.sendCompletionResolveRequest(completion!);
		expect(completion).toBeDefined();
	}
	return completion!;
}

/** The Vue file's text after applying the resolved completion item `itemLabel`. */
async function applyCompletionItem(fileName: string, content: string, itemLabel: string) {
	const item = await requestCompletionItemToVueServer(fileName, 'vue', content, itemLabel);
	const document = await prepareDocument(fileName, 'vue', content.replace('|', ''));
	const edits = [item.textEdit!, ...item.additionalTextEdits ?? []]
		.map(edit => 'range' in edit ? edit : { range: edit.replace, newText: edit.newText })
		.sort((a, b) => document.offsetAt(b.range.start) - document.offsetAt(a.range.start));
	let text = document.getText();
	for (const edit of edits) {
		text = text.slice(0, document.offsetAt(edit.range.start)) + edit.newText
			+ text.slice(document.offsetAt(edit.range.end));
	}
	// The TypeScript language server may generate CRLF on Windows
	return text.replace(/\r\n/g, '\n');
}

async function requestCompletionListToVueServer(fileName: string, languageId: string, content: string) {
	const offset = content.indexOf('|');
	expect(offset).toBeGreaterThanOrEqual(0);
	content = content.slice(0, offset) + content.slice(offset + 1);

	const server = await getLanguageServer();
	let document = await prepareDocument(fileName, languageId, content);

	const position = document.positionAt(offset);
	const completions = await server.vueserver.sendCompletionRequest(document.uri, position);
	expect(completions).toBeDefined();

	return completions!;
}

async function requestCompletionItemToTsServer(
	fileName: string,
	languageId: string,
	content: string,
	itemLabel: string,
) {
	const completions = await requestCompletionListToTsServer(fileName, languageId, content);
	const completion = completions.find(item => item.label === itemLabel);
	expect(completion).toBeDefined();
	delete completion!.data;
	return completion!;
}

async function requestCompletionListToTsServer(fileName: string, languageId: string, content: string) {
	const offset = content.indexOf('|');
	expect(offset).toBeGreaterThanOrEqual(0);
	content = content.slice(0, offset) + content.slice(offset + 1);

	const server = await getLanguageServer();
	const document = await prepareDocument(fileName, languageId, content);
	const completions = await server.typescript('textDocument/completion', {
		textDocument: { uri: document.uri },
		position: document.positionAt(offset),
	});
	return (Array.isArray(completions) ? completions : completions?.items ?? []) as CompletionItem[];
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
