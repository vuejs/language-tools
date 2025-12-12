import type { TextDocument } from '@volar/language-server';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server.js';

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
			'fixture.vue',
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
		{
		  "info": {
		    "canRename": true,
		    "displayName": "'foo'",
		    "fullDisplayName": "'foo'",
		    "kind": "property",
		    "kindModifiers": "",
		    "triggerSpan": {
		      "end": {
		        "line": 3,
		        "offset": 28,
		      },
		      "start": {
		        "line": 3,
		        "offset": 25,
		      },
		    },
		  },
		  "locs": [
		    {
		      "file": "\${testWorkspacePath}/fixture.vue",
		      "locs": [
		        {
		          "end": {
		            "line": 3,
		            "offset": 28,
		          },
		          "start": {
		            "line": 3,
		            "offset": 25,
		          },
		        },
		        {
		          "end": {
		            "line": 8,
		            "offset": 8,
		          },
		          "start": {
		            "line": 8,
		            "offset": 5,
		          },
		        },
		      ],
		    },
		  ],
		}
	`);
	expect(
		await requestRenameToTsServer(
			'fixture.vue',
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
	).toMatchInlineSnapshot(`
		{
		  "info": {
		    "canRename": true,
		    "displayName": "'foo'",
		    "fullDisplayName": "__type.'foo'",
		    "kind": "property",
		    "kindModifiers": "",
		    "triggerSpan": {
		      "end": {
		        "line": 3,
		        "offset": 20,
		      },
		      "start": {
		        "line": 3,
		        "offset": 17,
		      },
		    },
		  },
		  "locs": [
		    {
		      "file": "\${testWorkspacePath}/fixture.vue",
		      "locs": [
		        {
		          "end": {
		            "line": 3,
		            "offset": 20,
		          },
		          "start": {
		            "line": 3,
		            "offset": 17,
		          },
		        },
		        {
		          "end": {
		            "line": 7,
		            "offset": 8,
		          },
		          "start": {
		            "line": 7,
		            "offset": 5,
		          },
		        },
		      ],
		    },
		  ],
		}
	`);
	expect(
		await requestRenameToTsServer(
			'fixture.vue',
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
		{
		  "info": {
		    "canRename": true,
		    "displayName": "foo",
		    "fullDisplayName": "foo",
		    "kind": "property",
		    "kindModifiers": "",
		    "triggerSpan": {
		      "end": {
		        "line": 8,
		        "offset": 28,
		      },
		      "start": {
		        "line": 8,
		        "offset": 25,
		      },
		    },
		  },
		  "locs": [
		    {
		      "file": "\${testWorkspacePath}/fixture.vue",
		      "locs": [
		        {
		          "contextEnd": {
		            "line": 3,
		            "offset": 18,
		          },
		          "contextStart": {
		            "line": 3,
		            "offset": 4,
		          },
		          "end": {
		            "line": 3,
		            "offset": 13,
		          },
		          "start": {
		            "line": 3,
		            "offset": 10,
		          },
		        },
		        {
		          "end": {
		            "line": 12,
		            "offset": 35,
		          },
		          "start": {
		            "line": 12,
		            "offset": 32,
		          },
		        },
		        {
		          "end": {
		            "line": 12,
		            "offset": 29,
		          },
		          "start": {
		            "line": 12,
		            "offset": 26,
		          },
		        },
		        {
		          "end": {
		            "line": 11,
		            "offset": 35,
		          },
		          "start": {
		            "line": 11,
		            "offset": 32,
		          },
		        },
		        {
		          "end": {
		            "line": 11,
		            "offset": 29,
		          },
		          "start": {
		            "line": 11,
		            "offset": 26,
		          },
		        },
		        {
		          "end": {
		            "line": 10,
		            "offset": 29,
		          },
		          "start": {
		            "line": 10,
		            "offset": 26,
		          },
		        },
		        {
		          "end": {
		            "line": 9,
		            "offset": 29,
		          },
		          "start": {
		            "line": 9,
		            "offset": 26,
		          },
		        },
		        {
		          "end": {
		            "line": 8,
		            "offset": 28,
		          },
		          "start": {
		            "line": 8,
		            "offset": 25,
		          },
		        },
		      ],
		    },
		  ],
		}
	`);
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
		{
		  "info": {
		    "canRename": true,
		    "displayName": "aaaBbb",
		    "fullDisplayName": "__object.aaaBbb",
		    "kind": "property",
		    "kindModifiers": "",
		    "triggerSpan": {
		      "end": {
		        "line": 7,
		        "offset": 24,
		      },
		      "start": {
		        "line": 7,
		        "offset": 18,
		      },
		    },
		  },
		  "locs": [
		    {
		      "file": "\${testWorkspacePath}/tsconfigProject/fixture.vue",
		      "locs": [
		        {
		          "contextEnd": {
		            "line": 7,
		            "offset": 32,
		          },
		          "contextStart": {
		            "line": 7,
		            "offset": 18,
		          },
		          "end": {
		            "line": 7,
		            "offset": 24,
		          },
		          "start": {
		            "line": 7,
		            "offset": 18,
		          },
		        },
		        {
		          "end": {
		            "line": 3,
		            "offset": 14,
		          },
		          "start": {
		            "line": 3,
		            "offset": 8,
		          },
		        },
		      ],
		    },
		    {
		      "file": "\${testWorkspacePath}/tsconfigProject/foo.vue",
		      "locs": [
		        {
		          "end": {
		            "line": 4,
		            "offset": 17,
		          },
		          "start": {
		            "line": 4,
		            "offset": 11,
		          },
		        },
		        {
		          "end": {
		            "line": 3,
		            "offset": 18,
		          },
		          "start": {
		            "line": 3,
		            "offset": 11,
		          },
		        },
		      ],
		    },
		  ],
		}
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
		{
		  "info": {
		    "canRename": true,
		    "displayName": "aaaBbb",
		    "fullDisplayName": "__type.aaaBbb",
		    "kind": "property",
		    "kindModifiers": "",
		    "triggerSpan": {
		      "end": {
		        "line": 7,
		        "offset": 24,
		      },
		      "start": {
		        "line": 7,
		        "offset": 18,
		      },
		    },
		  },
		  "locs": [
		    {
		      "file": "\${testWorkspacePath}/tsconfigProject/fixture.vue",
		      "locs": [
		        {
		          "end": {
		            "line": 3,
		            "offset": 14,
		          },
		          "start": {
		            "line": 3,
		            "offset": 8,
		          },
		        },
		        {
		          "contextEnd": {
		            "line": 7,
		            "offset": 32,
		          },
		          "contextStart": {
		            "line": 7,
		            "offset": 18,
		          },
		          "end": {
		            "line": 7,
		            "offset": 24,
		          },
		          "start": {
		            "line": 7,
		            "offset": 18,
		          },
		        },
		      ],
		    },
		    {
		      "file": "\${testWorkspacePath}/tsconfigProject/foo.vue",
		      "locs": [
		        {
		          "end": {
		            "line": 4,
		            "offset": 17,
		          },
		          "start": {
		            "line": 4,
		            "offset": 11,
		          },
		        },
		        {
		          "end": {
		            "line": 3,
		            "offset": 18,
		          },
		          "start": {
		            "line": 3,
		            "offset": 11,
		          },
		        },
		      ],
		    },
		  ],
		}
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
		{
		  "info": {
		    "canRename": true,
		    "displayName": "foo",
		    "fullDisplayName": "foo",
		    "kind": "property",
		    "kindModifiers": "",
		    "triggerSpan": {
		      "end": {
		        "line": 3,
		        "offset": 15,
		      },
		      "start": {
		        "line": 3,
		        "offset": 12,
		      },
		    },
		  },
		  "locs": [
		    {
		      "file": "\${testWorkspacePath}/tsconfigProject/fixture.vue",
		      "locs": [
		        {
		          "contextEnd": {
		            "line": 7,
		            "offset": 22,
		          },
		          "contextStart": {
		            "line": 7,
		            "offset": 4,
		          },
		          "end": {
		            "line": 7,
		            "offset": 13,
		          },
		          "start": {
		            "line": 7,
		            "offset": 10,
		          },
		        },
		        {
		          "end": {
		            "line": 3,
		            "offset": 15,
		          },
		          "start": {
		            "line": 3,
		            "offset": 12,
		          },
		        },
		      ],
		    },
		  ],
		}
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
		{
		  "info": {
		    "canRename": true,
		    "displayName": "foo",
		    "fullDisplayName": "foo",
		    "kind": "property",
		    "kindModifiers": "",
		    "triggerSpan": {
		      "end": {
		        "line": 3,
		        "offset": 11,
		      },
		      "start": {
		        "line": 3,
		        "offset": 8,
		      },
		    },
		  },
		  "locs": [
		    {
		      "file": "\${testWorkspacePath}/tsconfigProject/fixture.vue",
		      "locs": [
		        {
		          "contextEnd": {
		            "line": 12,
		            "offset": 13,
		          },
		          "contextStart": {
		            "line": 12,
		            "offset": 7,
		          },
		          "end": {
		            "line": 12,
		            "offset": 10,
		          },
		          "start": {
		            "line": 12,
		            "offset": 7,
		          },
		        },
		        {
		          "end": {
		            "line": 3,
		            "offset": 11,
		          },
		          "start": {
		            "line": 3,
		            "offset": 8,
		          },
		        },
		      ],
		    },
		  ],
		}
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
		{
		  "info": {
		    "canRename": true,
		    "displayName": "foo",
		    "fullDisplayName": "foo",
		    "kind": "property",
		    "kindModifiers": "",
		    "triggerSpan": {
		      "end": {
		        "line": 3,
		        "offset": 11,
		      },
		      "start": {
		        "line": 3,
		        "offset": 8,
		      },
		    },
		  },
		  "locs": [
		    {
		      "file": "\${testWorkspacePath}/tsconfigProject/fixture.vue",
		      "locs": [
		        {
		          "contextEnd": {
		            "line": 7,
		            "offset": 18,
		          },
		          "contextStart": {
		            "line": 7,
		            "offset": 4,
		          },
		          "end": {
		            "line": 7,
		            "offset": 13,
		          },
		          "start": {
		            "line": 7,
		            "offset": 10,
		          },
		        },
		        {
		          "end": {
		            "line": 3,
		            "offset": 11,
		          },
		          "start": {
		            "line": 3,
		            "offset": 8,
		          },
		        },
		      ],
		    },
		  ],
		}
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
		{
		  "info": {
		    "canRename": true,
		    "displayName": "AaBb",
		    "fullDisplayName": "AaBb",
		    "kind": "alias",
		    "kindModifiers": "export",
		    "triggerSpan": {
		      "end": {
		        "line": 8,
		        "offset": 15,
		      },
		      "start": {
		        "line": 8,
		        "offset": 11,
		      },
		    },
		  },
		  "locs": [
		    {
		      "file": "\${testWorkspacePath}/tsconfigProject/fixture.vue",
		      "locs": [
		        {
		          "end": {
		            "line": 4,
		            "offset": 19,
		          },
		          "start": {
		            "line": 4,
		            "offset": 14,
		          },
		        },
		        {
		          "end": {
		            "line": 4,
		            "offset": 11,
		          },
		          "start": {
		            "line": 4,
		            "offset": 6,
		          },
		        },
		        {
		          "end": {
		            "line": 3,
		            "offset": 17,
		          },
		          "start": {
		            "line": 3,
		            "offset": 13,
		          },
		        },
		        {
		          "end": {
		            "line": 3,
		            "offset": 10,
		          },
		          "start": {
		            "line": 3,
		            "offset": 6,
		          },
		        },
		        {
		          "contextEnd": {
		            "line": 8,
		            "offset": 35,
		          },
		          "contextStart": {
		            "line": 8,
		            "offset": 4,
		          },
		          "end": {
		            "line": 8,
		            "offset": 15,
		          },
		          "start": {
		            "line": 8,
		            "offset": 11,
		          },
		        },
		      ],
		    },
		  ],
		}
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
		{
		  "info": {
		    "canRename": true,
		    "displayName": "Foo",
		    "fullDisplayName": ""vue".GlobalComponents.Foo",
		    "kind": "property",
		    "kindModifiers": "declare",
		    "triggerSpan": {
		      "end": {
		        "line": 5,
		        "offset": 9,
		      },
		      "start": {
		        "line": 5,
		        "offset": 6,
		      },
		    },
		  },
		  "locs": [
		    {
		      "file": "\${testWorkspacePath}/tsconfigProject/fixture.vue",
		      "locs": [
		        {
		          "end": {
		            "line": 11,
		            "offset": 15,
		          },
		          "start": {
		            "line": 11,
		            "offset": 12,
		          },
		        },
		        {
		          "end": {
		            "line": 11,
		            "offset": 9,
		          },
		          "start": {
		            "line": 11,
		            "offset": 6,
		          },
		        },
		        {
		          "contextEnd": {
		            "line": 5,
		            "offset": 15,
		          },
		          "contextStart": {
		            "line": 5,
		            "offset": 6,
		          },
		          "end": {
		            "line": 5,
		            "offset": 9,
		          },
		          "start": {
		            "line": 5,
		            "offset": 6,
		          },
		        },
		      ],
		    },
		  ],
		}
	`);
});

test('#4673', async () => {
	expect(
		await requestRenameToTsServer(
			'fixture.vue',
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
		{
		  "info": {
		    "canRename": true,
		    "displayName": "styl",
		    "fullDisplayName": "__type.styl",
		    "kind": "property",
		    "kindModifiers": "",
		    "triggerSpan": {
		      "end": {
		        "line": 9,
		        "offset": 22,
		      },
		      "start": {
		        "line": 9,
		        "offset": 18,
		      },
		    },
		  },
		  "locs": [
		    {
		      "file": "\${testWorkspacePath}/fixture.vue",
		      "locs": [
		        {
		          "end": {
		            "line": 9,
		            "offset": 22,
		          },
		          "start": {
		            "line": 9,
		            "offset": 18,
		          },
		        },
		        {
		          "end": {
		            "line": 16,
		            "offset": 23,
		          },
		          "start": {
		            "line": 16,
		            "offset": 19,
		          },
		        },
		        {
		          "end": {
		            "line": 5,
		            "offset": 40,
		          },
		          "start": {
		            "line": 5,
		            "offset": 36,
		          },
		        },
		      ],
		    },
		  ],
		}
	`);
});

test('Scoped Classes', async () => {
	expect(
		await requestRenameToTsServer(
			'fixture.vue',
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
	).toMatchInlineSnapshot(`
		{
		  "info": {
		    "canRename": true,
		    "displayName": "'foo'",
		    "fullDisplayName": "__type.'foo'",
		    "kind": "property",
		    "kindModifiers": "",
		    "triggerSpan": {
		      "end": {
		        "line": 3,
		        "offset": 22,
		      },
		      "start": {
		        "line": 3,
		        "offset": 19,
		      },
		    },
		  },
		  "locs": [
		    {
		      "file": "\${testWorkspacePath}/fixture.vue",
		      "locs": [
		        {
		          "end": {
		            "line": 5,
		            "offset": 23,
		          },
		          "start": {
		            "line": 5,
		            "offset": 20,
		          },
		        },
		        {
		          "end": {
		            "line": 4,
		            "offset": 32,
		          },
		          "start": {
		            "line": 4,
		            "offset": 29,
		          },
		        },
		        {
		          "end": {
		            "line": 4,
		            "offset": 23,
		          },
		          "start": {
		            "line": 4,
		            "offset": 20,
		          },
		        },
		        {
		          "end": {
		            "line": 3,
		            "offset": 22,
		          },
		          "start": {
		            "line": 3,
		            "offset": 19,
		          },
		        },
		        {
		          "end": {
		            "line": 8,
		            "offset": 8,
		          },
		          "start": {
		            "line": 8,
		            "offset": 5,
		          },
		        },
		      ],
		    },
		  ],
		}
	`);
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
		{
		  "info": {
		    "canRename": true,
		    "displayName": "foo",
		    "fullDisplayName": "__type.foo",
		    "kind": "property",
		    "kindModifiers": "",
		    "triggerSpan": {
		      "end": {
		        "line": 8,
		        "offset": 34,
		      },
		      "start": {
		        "line": 8,
		        "offset": 31,
		      },
		    },
		  },
		  "locs": [
		    {
		      "file": "\${testWorkspacePath}/tsconfigProject/fixture.vue",
		      "locs": [
		        {
		          "end": {
		            "line": 3,
		            "offset": 16,
		          },
		          "start": {
		            "line": 3,
		            "offset": 13,
		          },
		        },
		        {
		          "end": {
		            "line": 8,
		            "offset": 34,
		          },
		          "start": {
		            "line": 8,
		            "offset": 31,
		          },
		        },
		      ],
		    },
		  ],
		}
	`);
});

const openedDocuments: TextDocument[] = [];

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

	const res = await server.tsserver.message({
		seq: server.nextSeq(),
		command: 'rename',
		arguments: {
			file: URI.parse(document.uri).fsPath,
			position: offset,
			findInStrings: false,
			findInComments: false,
		},
	});

	expect(res!.success).toBe(true);

	for (const loc of res!.body.locs) {
		loc.file = '${testWorkspacePath}' + loc.file.slice(testWorkspacePath.length);
	}

	return res.body;
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
