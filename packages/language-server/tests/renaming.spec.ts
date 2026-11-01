import type { Range, TextDocument } from '@volar/language-server';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { formatLocations, getLanguageServer, testWorkspacePath } from './server';

test('#2410', async () => {
	expect(
		await requestRenameToVueServer('fixture.vue', 'vue', `<template><|h1></h1></template>`, 'h2'),
	).toMatchInlineSnapshot(`
			{
			  "changes": {
			    "file://\${testWorkspacePath}/fixture.vue": [
			      {
			        "newText": "h2",
			        "range": {
			          "end": {
			            "character": 18,
			            "line": 0,
			          },
			          "start": {
			            "character": 16,
			            "line": 0,
			          },
			        },
			      },
			      {
			        "newText": "h2",
			        "range": {
			          "end": {
			            "character": 13,
			            "line": 0,
			          },
			          "start": {
			            "character": 11,
			            "line": 0,
			          },
			        },
			      },
			    ],
			  },
			}
		`);
	expect(
		await requestRenameToVueServer('fixture.vue', 'vue', `<template><h1|></h1></template>`, 'h2'),
	).toMatchInlineSnapshot(`
			{
			  "changes": {
			    "file://\${testWorkspacePath}/fixture.vue": [
			      {
			        "newText": "h2",
			        "range": {
			          "end": {
			            "character": 18,
			            "line": 0,
			          },
			          "start": {
			            "character": 16,
			            "line": 0,
			          },
			        },
			      },
			      {
			        "newText": "h2",
			        "range": {
			          "end": {
			            "character": 13,
			            "line": 0,
			          },
			          "start": {
			            "character": 11,
			            "line": 0,
			          },
			        },
			      },
			    ],
			  },
			}
		`);
});

test('CSS', async () => {
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
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
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:2:24-2:27 -> NEW",
		  "tsconfigProject/fixture.vue:7:4-7:7 -> NEW",
		]
	`);
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<script lang="ts" setup>
			const foo = 1;
			</script>

			<style>
			/* .bar { color: v-bind(foo); } */
			.bar { color: v-bind(foo|); }
			.bar { color: v-bind('foo'); }
			.bar { color: v-bind("foo"); }
			.bar { color: v-bind('foo + foo'); }
			.bar { color: v-bind("foo + foo"); }
			.bar { color: v-bind(); }
			</style>

			<style lang="scss">
			// .bar { color: v-bind(foo); }
			</style>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:10:25-10:28 -> NEW",
		  "tsconfigProject/fixture.vue:10:31-10:34 -> NEW",
		  "tsconfigProject/fixture.vue:11:25-11:28 -> NEW",
		  "tsconfigProject/fixture.vue:11:31-11:34 -> NEW",
		  "tsconfigProject/fixture.vue:2:9-2:12 -> NEW",
		  "tsconfigProject/fixture.vue:7:24-7:27 -> NEW",
		  "tsconfigProject/fixture.vue:8:25-8:28 -> NEW",
		  "tsconfigProject/fixture.vue:9:25-9:28 -> NEW",
		]
	`);
});

test('Scoped class names in a static class attribute', async () => {
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<div class="foo|"></div>
			</template>

			<style scoped>
			.foo { }
			</style>
		`,
		),
	).toEqual(['tsconfigProject/fixture.vue:2:16-2:19 -> NEW', 'tsconfigProject/fixture.vue:6:4-6:7 -> NEW']);
});

test('The CSS service leaves the names TypeScript renames to it', async () => {
	const content = `
<script setup lang="ts">
const foo = 1;
</script>
<template><div :class="$style.mod"></div></template>
<style module>
.mod { color: v-bind(foo); }
</style>
<style>
.plain { }
</style>
`;
	const document = await prepareDocument('tsconfigProject/fixture.vue', 'vue', content);
	const server = await getLanguageServer();
	const prepareRename = (text: string) =>
		server.vueserver.connection.sendRequest('textDocument/prepareRename', {
			textDocument: { uri: document.uri },
			position: document.positionAt(content.indexOf(text) + 1),
		});
	expect(await prepareRename('mod {')).toBeNull();
	expect(await prepareRename('foo);')).toBeNull();
	expect(await prepareRename('plain')).toMatchObject({
		start: { line: 9, character: 0 },
		end: { line: 9, character: 6 },
	});
});

test('Component props', async () => {
	await prepareDocument(
		'tsconfigProject/foo.vue',
		'vue',
		`
		<template>
			<Comp :aaa-bbb="'foo'"></Comp>
			<Comp :aaaBbb="'foo'"></Comp>
		</template>

		<script lang="ts" setup>
		import Comp from './fixture.vue';
		</script>
	`,
	);
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				{{ aaaBbb }}
			</template>

			<script lang="ts" setup>
			defineProps({ aaaBbb|: String });
			</script>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:2:7-2:13 -> NEW",
		  "tsconfigProject/fixture.vue:6:17-6:23 -> NEW",
		  "tsconfigProject/foo.vue:3:10-3:16 -> NEW",
		]
	`);
});

test('Component type props', async () => {
	await prepareDocument(
		'tsconfigProject/foo.vue',
		'vue',
		`
		<template>
			<Comp :aaa-bbb="'foo'"></Comp>
			<Comp :aaaBbb="'foo'"></Comp>
		</template>

		<script lang="ts" setup>
		import Comp from './fixture.vue';
		</script>
	`,
	);
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				{{ aaaBbb }}
			</template>

			<script lang="ts" setup>
			defineProps<{ aaaBbb|: String }>();
			</script>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:2:7-2:13 -> NEW",
		  "tsconfigProject/fixture.vue:6:17-6:23 -> NEW",
		  "tsconfigProject/foo.vue:3:10-3:16 -> NEW",
		]
	`);
});

test('Component dynamic props', async () => {
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<div :[foo|]="123"></div>
			</template>

			<script lang="ts" setup>
			const foo = 'foo';
			</script>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:2:11-2:14 -> NEW",
		  "tsconfigProject/fixture.vue:6:9-6:12 -> NEW",
		]
	`);
});

test('#6176', async () => {
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<div :[foo|]="123"></div>
			</template>

			<script lang="ts" setup>
			import { useTemplateRef } from 'vue';
			const foo = useTemplateRef('foo');
			</script>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:2:11-2:14 -> NEW",
		  "tsconfigProject/fixture.vue:7:9-7:12 -> NEW",
		]
	`);
});

test('Component returns', async () => {
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
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
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:11:6-11:9 -> NEW",
		  "tsconfigProject/fixture.vue:2:7-2:10 -> NEW",
		]
	`);
});

test('<script setup>', async () => {
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				{{ foo| }}
			</template>

			<script lang="ts" setup>
			const foo = 1;
			</script>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:2:7-2:10 -> NEW",
		  "tsconfigProject/fixture.vue:6:9-6:12 -> NEW",
		]
	`);
});

test('Component tags', async () => {
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<AaBb></AaBb>
				<aa-bb></aa-bb>
			</template>

			<script lang="ts" setup>
			import AaBb| from './empty.vue';
			</script>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:2:12-2:16 -> NEW",
		  "tsconfigProject/fixture.vue:2:5-2:9 -> NEW",
		  "tsconfigProject/fixture.vue:7:10-7:14 -> NEW",
		]
	`);
});

test('Global component tags', async () => {
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<script lang="ts" setup>
			declare module 'vue' {
				export interface GlobalComponents {
					Foo|: any;
				}
			}
			</script>

			<template>
				<Foo></Foo>
			</template>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:10:11-10:14 -> NEW",
		  "tsconfigProject/fixture.vue:10:5-10:8 -> NEW",
		  "tsconfigProject/fixture.vue:4:5-4:8 -> NEW",
		]
	`);
});

test('#4673', async () => {
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<script setup lang="ts">
			import { useCssModule } from 'vue';
			const $style = useCssModule();
			const stylAlias = useCssModule('styl');
			</script>

			<template>
				<div :class="styl|.foo">{{  }}</div>
			</template>

			<style module>
			.foo { }
			</style>

			<style module="styl">
			.foo { }
			</style>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:15:18-15:22 -> NEW",
		  "tsconfigProject/fixture.vue:4:35-4:39 -> NEW",
		  "tsconfigProject/fixture.vue:8:17-8:21 -> NEW",
		]
	`);
});

test('Scoped class names in :class from the template', async () => {
	for (const position of [`'|foo'`, `'foo|'`]) {
		expect(
			await requestRenameToTsServer(
				'tsconfigProject/fixture.vue',
				'vue',
				`
			<template>
				<div :class="${position}"></div>
				<div :class="['foo', { 'foo': true }]"></div>
			</template>
			<style scoped>
			.foo { }
			</style>
		`,
			),
		).toEqual([
			'tsconfigProject/fixture.vue:2:18-2:21 -> NEW',
			'tsconfigProject/fixture.vue:3:19-3:22 -> NEW',
			'tsconfigProject/fixture.vue:3:28-3:31 -> NEW',
			'tsconfigProject/fixture.vue:6:4-6:7 -> NEW',
		]);
	}
});

// Waits on TS-1, as for the class name shorthands below: `{ foo }` maps to a generated `foo: foo`.
test.fails('Scoped Classes', async () => {
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<div :class="'foo|'"></div>
				<div :class="['foo', { 'foo': true }]"></div>
				<div :class="{ foo }"></div>
			</template>
			<style scoped>
			.foo { }
			</style>
		`,
		),
	).toEqual([
		'tsconfigProject/fixture.vue:2:18-2:21 -> NEW',
		'tsconfigProject/fixture.vue:3:19-3:22 -> NEW',
		'tsconfigProject/fixture.vue:3:28-3:31 -> NEW',
		'tsconfigProject/fixture.vue:4:19-4:22 -> NEW: foo',
		'tsconfigProject/fixture.vue:7:4-7:7 -> NEW',
	]);
});

test('Scoped class names in :class from the style block', async () => {
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<div :class="'foo'"></div>
				<div :class="['foo', { 'foo': true }]"></div>
			</template>
			<style scoped>
			.fo|o { }
			</style>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:2:18-2:21 -> NEW",
		  "tsconfigProject/fixture.vue:3:19-3:22 -> NEW",
		  "tsconfigProject/fixture.vue:3:28-3:31 -> NEW",
		  "tsconfigProject/fixture.vue:6:4-6:7 -> NEW",
		]
	`);
});

// Waits on TypeScript expanding a shorthand of the source on rename through span maps (upstream ask TS-1): the key of
// `{ foo }` maps to a generated `foo: foo`, whose spans take no rename edit, so TypeScript drops it. Exit: this passes
// once span maps can mark a same-name shorthand and TypeScript expands it.
test.fails('Scoped class name shorthands in :class from the style block', async () => {
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<div :class="'foo'"></div>
				<div :class="['foo', { 'foo': true }]"></div>
				<div :class="{ foo }"></div>
			</template>
			<style scoped>
			.fo|o { }
			</style>
		`,
		),
	).toEqual([
		'tsconfigProject/fixture.vue:2:18-2:21 -> NEW',
		'tsconfigProject/fixture.vue:3:19-3:22 -> NEW',
		'tsconfigProject/fixture.vue:3:28-3:31 -> NEW',
		'tsconfigProject/fixture.vue:4:19-4:22 -> NEW: foo',
		'tsconfigProject/fixture.vue:7:4-7:7 -> NEW',
	]);
});

test('Template Ref', async () => {
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<a ref="foo"></a>
			</template>

			<script lang="ts" setup>
			import { useTemplateRef } from 'vue';
			const el = useTemplateRef('foo|');
			</script>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:2:12-2:15 -> NEW",
		  "tsconfigProject/fixture.vue:7:30-7:33 -> NEW",
		]
	`);
});

// Waits on TS-1, as for the class name shorthands above: the same-name shorthands map to a generated `key: value`.
test.fails('Same Name Shorthand', async () => {
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<Comp :foo-bar| />
				{{ new Comp({ fooBar }) }}
			</template>

			<script lang="ts" setup>
			const fooBar = 1;
			</script>
		`,
		),
	).toEqual([
		'tsconfigProject/fixture.vue:2:11-2:18 -> foo-bar="NEW"',
		'tsconfigProject/fixture.vue:3:18-3:24 -> fooBar: NEW',
		'tsconfigProject/fixture.vue:7:9-7:15 -> NEW',
	]);
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<Comp :foo-bar />
				{{ new Comp({ fooBar }) }}
			</template>

			<script lang="ts" setup>
			declare function Comp(props: {
				fooBar|: number;
			}): void;
			</script>
		`,
		),
	).toEqual([
		'tsconfigProject/fixture.vue:2:11-2:18 -> NEW="fooBar"',
		'tsconfigProject/fixture.vue:3:18-3:24 -> NEW: fooBar',
		'tsconfigProject/fixture.vue:8:4-8:10 -> NEW',
	]);
});

const openedDocuments: TextDocument[] = [];

test('Setup binding access positions', async () => {
	// interpolation read
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				{{ cou|nt }}
			</template>

			<script lang="ts" setup>
			import { ref } from 'vue';
			const count = ref(0);
			</script>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:2:7-2:12 -> NEW",
		  "tsconfigProject/fixture.vue:7:9-7:14 -> NEW",
		]
	`);

	// v-for source
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<div v-for="n in num|s">{{ n }}</div>
			</template>

			<script lang="ts" setup>
			import { ref } from 'vue';
			const nums = ref<number[]>([]);
			</script>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:2:21-2:25 -> NEW",
		  "tsconfigProject/fixture.vue:7:9-7:13 -> NEW",
		]
	`);

	// inline event handler write target
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<button @click="cou|nt++" />
			</template>

			<script lang="ts" setup>
			import { ref } from 'vue';
			const count = ref(0);
			</script>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:2:20-2:25 -> NEW",
		  "tsconfigProject/fixture.vue:7:9-7:14 -> NEW",
		]
	`);

	// inline for-of with a same-named loop variable: matches plain TS, which
	// binds the source to the loop declaration (TS2448), so rename covers the
	// loop variable's occurrences
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<button @click="for (const nums of nu|ms) {}" />
			</template>

			<script lang="ts" setup>
			import { ref } from 'vue';
			const nums = ref<number[]>([]);
			</script>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  "tsconfigProject/fixture.vue:2:31-2:35 -> NEW",
		  "tsconfigProject/fixture.vue:2:39-2:43 -> NEW",
		]
	`);
});

// Waits on TS-1, as for the same-name shorthands above.
test.fails('Setup binding access positions: v-bind shorthand', async () => {
	expect(
		await requestRenameToTsServer(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<template>
				<div :cou|nt />
			</template>

			<script lang="ts" setup>
			import { ref } from 'vue';
			const count = ref(0);
			</script>
		`,
		),
	).toEqual([
		'tsconfigProject/fixture.vue:2:10-2:15 -> count="NEW"',
		'tsconfigProject/fixture.vue:7:9-7:14 -> NEW',
	]);
});

afterEach(async () => {
	const server = await getLanguageServer();
	for (const document of openedDocuments) {
		await server.close(document.uri);
	}
	openedDocuments.length = 0;
});

async function requestRenameToVueServer(fileName: string, languageId: string, _content: string, newName: string) {
	const offset = _content.indexOf('|');
	expect(offset).toBeGreaterThanOrEqual(0);
	const content = _content.slice(0, offset) + _content.slice(offset + 1);

	const server = await getLanguageServer();
	let document = await prepareDocument(fileName, languageId, content);

	const position = document.positionAt(offset);
	const edit = await server.vueserver.sendRenameRequest(document.uri, position, newName);
	expect(edit?.changes).toBeDefined();

	for (const [uri, edits] of Object.entries(edit!.changes!)) {
		delete edit!.changes![uri];
		edit!.changes!['file://${testWorkspacePath}' + uri.slice(URI.file(testWorkspacePath).toString().length)] = edits;
	}

	return edit;
}

async function requestRenameToTsServer(fileName: string, languageId: string, _content: string) {
	const offset = _content.indexOf('|');
	expect(offset).toBeGreaterThanOrEqual(0);
	const content = _content.slice(0, offset) + _content.slice(offset + 1);

	const server = await getLanguageServer();
	let document = await prepareDocument(fileName, languageId, content);

	const edit = await server.typescript('textDocument/rename', {
		textDocument: { uri: document.uri },
		position: document.positionAt(offset),
		newName: 'NEW',
	});
	return Object.entries<{ range: Range; newText: string }[]>(edit?.changes ?? {})
		.flatMap(([uri, edits]) => edits.map(({ range, newText }) => `${formatLocations({ uri, range })[0]} -> ${newText}`))
		.sort();
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
