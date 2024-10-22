import { TextDocument } from '@volar/language-server';
import { afterEach, describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server.js';

describe('Renaming', async () => {

	it('#2410', async () => {
		expect(
			await requestRename('fixture.vue', 'vue', `<template><|h1></h1></template>`, 'h2')
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
			await requestRename('fixture.vue', 'vue', `<template><h1|></h1></template>`, 'h2')
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

	it('CSS', async () => {
		expect(
			await requestRename('fixture.vue', 'vue', `
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
		`, 'bar')
		).toMatchInlineSnapshot(`
			{
			  "changes": {
			    "file://\${testWorkspacePath}/fixture.vue": [
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 8,
			            "line": 7,
			          },
			          "start": {
			            "character": 5,
			            "line": 7,
			          },
			        },
			      },
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 28,
			            "line": 2,
			          },
			          "start": {
			            "character": 25,
			            "line": 2,
			          },
			        },
			      },
			    ],
			  },
			}
		`);
		expect(
			await requestRename('fixture.vue', 'vue', `
				<template>
					<div class="foo|"></div>
				</template>

				<style scoped>
				.foo { }
				</style>
		`, 'bar')
		).toMatchInlineSnapshot(`
			{
			  "changes": {
			    "file://\${testWorkspacePath}/fixture.vue": [
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 20,
			            "line": 2,
			          },
			          "start": {
			            "character": 17,
			            "line": 2,
			          },
			        },
			      },
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 8,
			            "line": 6,
			          },
			          "start": {
			            "character": 5,
			            "line": 6,
			          },
			        },
			      },
			    ],
			  },
			}
		`);
		expect(
			await requestRename('fixture.vue', 'vue', `
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
			`, 'bar')
		).toMatchInlineSnapshot(`
			{
			  "changes": {
			    "file://\${testWorkspacePath}/fixture.vue": [
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 28,
			            "line": 7,
			          },
			          "start": {
			            "character": 25,
			            "line": 7,
			          },
			        },
			      },
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 13,
			            "line": 2,
			          },
			          "start": {
			            "character": 10,
			            "line": 2,
			          },
			        },
			      },
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 35,
			            "line": 11,
			          },
			          "start": {
			            "character": 32,
			            "line": 11,
			          },
			        },
			      },
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 29,
			            "line": 11,
			          },
			          "start": {
			            "character": 26,
			            "line": 11,
			          },
			        },
			      },
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 35,
			            "line": 10,
			          },
			          "start": {
			            "character": 32,
			            "line": 10,
			          },
			        },
			      },
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 29,
			            "line": 10,
			          },
			          "start": {
			            "character": 26,
			            "line": 10,
			          },
			        },
			      },
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 29,
			            "line": 9,
			          },
			          "start": {
			            "character": 26,
			            "line": 9,
			          },
			        },
			      },
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 29,
			            "line": 8,
			          },
			          "start": {
			            "character": 26,
			            "line": 8,
			          },
			        },
			      },
			    ],
			  },
			}
		`);
	});

	it('Component props', async () => {
		await prepareDocument('tsconfigProject/foo.vue', 'vue', `
			<template>
				<Comp :aaa-bbb="'foo'"></Comp>
				<Comp :aaaBbb="'foo'"></Comp>
			</template>

			<script lang="ts" setup>
			import Comp from './fixture.vue';
			</script>
		`);
		expect(
			await requestRename('tsconfigProject/fixture.vue', 'vue', `
				<template>
					{{ aaaBbb }}
				</template>

				<script lang="ts" setup>
				defineProps({ aaaBbb|: String });
				</script>
			`, 'cccDdd')
		).toMatchInlineSnapshot(`
			{
			  "changes": {
			    "file://\${testWorkspacePath}/tsconfigProject/fixture.vue": [
			      {
			        "newText": "cccDdd",
			        "range": {
			          "end": {
			            "character": 24,
			            "line": 6,
			          },
			          "start": {
			            "character": 18,
			            "line": 6,
			          },
			        },
			      },
			      {
			        "newText": "cccDdd",
			        "range": {
			          "end": {
			            "character": 14,
			            "line": 2,
			          },
			          "start": {
			            "character": 8,
			            "line": 2,
			          },
			        },
			      },
			    ],
			    "file://\${testWorkspacePath}/tsconfigProject/foo.vue": [
			      {
			        "newText": "cccDdd",
			        "range": {
			          "end": {
			            "character": 17,
			            "line": 3,
			          },
			          "start": {
			            "character": 11,
			            "line": 3,
			          },
			        },
			      },
			      {
			        "newText": "ccc-ddd",
			        "range": {
			          "end": {
			            "character": 18,
			            "line": 2,
			          },
			          "start": {
			            "character": 11,
			            "line": 2,
			          },
			        },
			      },
			    ],
			  },
			}
		`);
	});

	it('Component type props', async () => {
		await prepareDocument('tsconfigProject/foo.vue', 'vue', `
			<template>
				<Comp :aaa-bbb="'foo'"></Comp>
				<Comp :aaaBbb="'foo'"></Comp>
			</template>

			<script lang="ts" setup>
			import Comp from './fixture.vue';
			</script>
		`);
		expect(
			await requestRename('tsconfigProject/fixture.vue', 'vue', `
				<template>
					{{ aaaBbb }}
				</template>

				<script lang="ts" setup>
				defineProps<{ aaaBbb|: String }>();
				</script>
			`, 'cccDdd')
		).toMatchInlineSnapshot(`
			{
			  "changes": {
			    "file://\${testWorkspacePath}/tsconfigProject/fixture.vue": [
			      {
			        "newText": "cccDdd",
			        "range": {
			          "end": {
			            "character": 14,
			            "line": 2,
			          },
			          "start": {
			            "character": 8,
			            "line": 2,
			          },
			        },
			      },
			      {
			        "newText": "cccDdd",
			        "range": {
			          "end": {
			            "character": 24,
			            "line": 6,
			          },
			          "start": {
			            "character": 18,
			            "line": 6,
			          },
			        },
			      },
			    ],
			    "file://\${testWorkspacePath}/tsconfigProject/foo.vue": [
			      {
			        "newText": "cccDdd",
			        "range": {
			          "end": {
			            "character": 17,
			            "line": 3,
			          },
			          "start": {
			            "character": 11,
			            "line": 3,
			          },
			        },
			      },
			      {
			        "newText": "ccc-ddd",
			        "range": {
			          "end": {
			            "character": 18,
			            "line": 2,
			          },
			          "start": {
			            "character": 11,
			            "line": 2,
			          },
			        },
			      },
			    ],
			  },
			}
		`);
	});

	it('Component dynamic props', async () => {
		expect(
			await requestRename('tsconfigProject/fixture.vue', 'vue', `
				<template>
					<div :[foo|]="123"></div>
				</template>

				<script lang="ts" setup>
				const foo = 'foo';
				</script>
			`, 'bar')
		).toMatchInlineSnapshot(`
			{
			  "changes": {
			    "file://\${testWorkspacePath}/tsconfigProject/fixture.vue": [
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 13,
			            "line": 6,
			          },
			          "start": {
			            "character": 10,
			            "line": 6,
			          },
			        },
			      },
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 15,
			            "line": 2,
			          },
			          "start": {
			            "character": 12,
			            "line": 2,
			          },
			        },
			      },
			    ],
			  },
			}
		`);
	});

	it('Component returns', async () => {
		expect(
			await requestRename('tsconfigProject/fixture.vue', 'vue', `
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
			`, 'bar')
		).toMatchInlineSnapshot(`
			{
			  "changes": {
			    "file://\${testWorkspacePath}/tsconfigProject/fixture.vue": [
			      {
			        "newText": "bar",
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
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 10,
			            "line": 11,
			          },
			          "start": {
			            "character": 7,
			            "line": 11,
			          },
			        },
			      },
			    ],
			  },
			}
		`);
	});

	it('<script setup>', async () => {
		expect(
			await requestRename('tsconfigProject/fixture.vue', 'vue', `
				<template>
					{{ foo| }}
				</template>

				<script lang="ts" setup>
				const foo = 1;
				</script>
			`, 'bar')
		).toMatchInlineSnapshot(`
			{
			  "changes": {
			    "file://\${testWorkspacePath}/tsconfigProject/fixture.vue": [
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 13,
			            "line": 6,
			          },
			          "start": {
			            "character": 10,
			            "line": 6,
			          },
			        },
			      },
			      {
			        "newText": "bar",
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
			    ],
			  },
			}
		`);
	});

	it('Component tags', async () => {
		expect(
			await requestRename('tsconfigProject/fixture.vue', 'vue', `
				<template>
					<AaBb></AaBb>
					<aa-bb></aa-bb>
				</template>

				<script lang="ts" setup>
				import AaBb| from './empty.vue';
				</script>
			`, 'CcDd')
		).toMatchInlineSnapshot(`
			{
			  "changes": {
			    "file://\${testWorkspacePath}/tsconfigProject/fixture.vue": [
			      {
			        "newText": "cc-dd",
			        "range": {
			          "end": {
			            "character": 19,
			            "line": 3,
			          },
			          "start": {
			            "character": 14,
			            "line": 3,
			          },
			        },
			      },
			      {
			        "newText": "cc-dd",
			        "range": {
			          "end": {
			            "character": 11,
			            "line": 3,
			          },
			          "start": {
			            "character": 6,
			            "line": 3,
			          },
			        },
			      },
			      {
			        "newText": "CcDd",
			        "range": {
			          "end": {
			            "character": 17,
			            "line": 2,
			          },
			          "start": {
			            "character": 13,
			            "line": 2,
			          },
			        },
			      },
			      {
			        "newText": "CcDd",
			        "range": {
			          "end": {
			            "character": 10,
			            "line": 2,
			          },
			          "start": {
			            "character": 6,
			            "line": 2,
			          },
			        },
			      },
			      {
			        "newText": "CcDd",
			        "range": {
			          "end": {
			            "character": 15,
			            "line": 7,
			          },
			          "start": {
			            "character": 11,
			            "line": 7,
			          },
			        },
			      },
			    ],
			  },
			}
		`);
	});

	it('#4673', async () => {
		expect(
			await requestRename('fixture.vue', 'vue', `
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
			`, 'stylus')
		).toMatchInlineSnapshot(`
			{
			  "changes": {
			    "file://\${testWorkspacePath}/fixture.vue": [
			      {
			        "newText": "stylus",
			        "range": {
			          "end": {
			            "character": 23,
			            "line": 15,
			          },
			          "start": {
			            "character": 19,
			            "line": 15,
			          },
			        },
			      },
			      {
			        "newText": "stylus",
			        "range": {
			          "end": {
			            "character": 22,
			            "line": 8,
			          },
			          "start": {
			            "character": 18,
			            "line": 8,
			          },
			        },
			      },
			      {
			        "newText": "stylus",
			        "range": {
			          "end": {
			            "character": 40,
			            "line": 4,
			          },
			          "start": {
			            "character": 36,
			            "line": 4,
			          },
			        },
			      },
			    ],
			  },
			}
		`);
	});

	it('Scoped Classes', async () => {
		expect(
			await requestRename('fixture.vue', 'vue', `
				<template>
					<div :class="'foo|'"></div>
					<div :class="['foo', { 'foo': true }]"></div>
					<div :class="{ foo }"></div>
				</template>
				<style scoped>
				.foo { }
				</style>
			`, 'bar')
		).toMatchInlineSnapshot(`
			{
			  "changes": {
			    "file://\${testWorkspacePath}/fixture.vue": [
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 23,
			            "line": 4,
			          },
			          "start": {
			            "character": 20,
			            "line": 4,
			          },
			        },
			      },
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 32,
			            "line": 3,
			          },
			          "start": {
			            "character": 29,
			            "line": 3,
			          },
			        },
			      },
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 23,
			            "line": 3,
			          },
			          "start": {
			            "character": 20,
			            "line": 3,
			          },
			        },
			      },
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 22,
			            "line": 2,
			          },
			          "start": {
			            "character": 19,
			            "line": 2,
			          },
			        },
			      },
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 8,
			            "line": 7,
			          },
			          "start": {
			            "character": 5,
			            "line": 7,
			          },
			        },
			      },
			    ],
			  },
			}
		`);
	});

	it('Ref', async () => {
		expect(
			await requestRename('tsconfigProject/fixture.vue', 'vue', `
				<template>
					<a ref="foo"></a>
				</template>

				<script lang="ts" setup>
				import { ref } from 'vue';
				const foo| = ref();
				</script>
			`, 'bar')
		).toMatchInlineSnapshot(`
			{
			  "changes": {
			    "file://\${testWorkspacePath}/tsconfigProject/fixture.vue": [
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 16,
			            "line": 2,
			          },
			          "start": {
			            "character": 13,
			            "line": 2,
			          },
			        },
			      },
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 13,
			            "line": 7,
			          },
			          "start": {
			            "character": 10,
			            "line": 7,
			          },
			        },
			      },
			    ],
			  },
			}
		`);
	});

	it('Template Ref', async () => {
		expect(
			await requestRename('tsconfigProject/fixture.vue', 'vue', `
				<template>
					<a ref="foo"></a>
				</template>

				<script lang="ts" setup>
				import { useTemplateRef } from 'vue';
				const el = useTemplateRef('foo|');
				</script>
			`, 'bar')
		).toMatchInlineSnapshot(`
			{
			  "changes": {
			    "file://\${testWorkspacePath}/tsconfigProject/fixture.vue": [
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 34,
			            "line": 7,
			          },
			          "start": {
			            "character": 31,
			            "line": 7,
			          },
			        },
			      },
			      {
			        "newText": "bar",
			        "range": {
			          "end": {
			            "character": 16,
			            "line": 2,
			          },
			          "start": {
			            "character": 13,
			            "line": 2,
			          },
			        },
			      },
			    ],
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

	async function requestRename(fileName: string, languageId: string, _content: string, newName: string) {
		const offset = _content.indexOf('|');
		expect(offset).toBeGreaterThanOrEqual(0);
		const content = _content.slice(0, offset) + _content.slice(offset + 1);

		const server = await getLanguageServer();
		let document = await prepareDocument(fileName, languageId, content);

		const position = document.positionAt(offset);
		const edit = await server.sendRenameRequest(document.uri, position, newName);
		expect(edit?.changes).toBeDefined();

		for (const [uri, edits] of Object.entries(edit!.changes!)) {
			delete edit!.changes![uri];
			edit!.changes!['file://${testWorkspacePath}' + uri.slice(URI.file(testWorkspacePath).toString().length)] = edits;
		}

		return edit;
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
