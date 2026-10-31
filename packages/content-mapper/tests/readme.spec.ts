import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { loadCodegenPlugins, type VueCodegenPlugin } from '../lib/codegen/plugin';
import { generate } from './utils';

/** The `codegen` of each plugin module of the README's examples, by the file name that its first line gives. */
const examples = new Map(
	[
		...fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8').matchAll(
			/^```js\n\/\/ ([\w-]+\.js)\b(.*?)^```$/gms,
		),
	]
		.map(([source, fileName]) => {
			const module: { exports: { codegen?: VueCodegenPlugin } } = { exports: {} };
			new Function('exports', 'require', source.slice('```js\n'.length, -'```'.length))(module.exports, require);
			return [fileName!, module.exports.codegen!];
		}),
);

function generateWith(example: string, fileName: string, content: string) {
	const codegen = examples.get(example);
	expect(codegen).toBeTypeOf('function');
	const { plugins } = loadCodegenPlugins({ plugins: [{ name: example, config: {}, module: { codegen } }] } as never);
	return generate(fileName, content, undefined, plugins);
}

test('route-plugin.js types the route of the page in its script and template', () => {
	const { text } = generateWith(
		'route-plugin.js',
		'/Page.vue',
		`<script setup lang="ts">\nimport { useRoute } from 'vue-router';\nconst route = useRoute();\n</script>\n`
			+ `<template>{{ $route.path }}</template>\n`,
	);
	expect(text).toContain(`const route = useRoute<"/Page">();`);
	expect(text).toContain(`type __VLS_Route = import('vue-router').RouteLocationNormalizedLoaded<"/Page">;`);
	expect(text).toContain('{ $route: __VLS_Route }');
});

test('define-prop.js declares a public prop by the type argument of the macro, mapped to it', () => {
	const content = `<script setup lang="ts">\ndefineProp<number>('count');\n</script>\n`;
	const { text, mappings } = generateWith('define-prop.js', '/Comp.vue', content);
	expect(text).not.toContain('defineProp');
	const type = text.indexOf('{ "count"?: number }') + '{ "count"?: '.length;
	expect(type).toBeGreaterThanOrEqual('{ "count"?: '.length);
	expect(
		mappings.some(({ virtualStart, originalStart }) =>
			virtualStart === type && originalStart === content.indexOf('number')
		),
	).toBe(true);
});
