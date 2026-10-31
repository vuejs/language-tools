import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { loadCodegenPlugins, type VueCodegenPlugin } from '../lib/codegen/plugin';
import { generate, normalizeCompilerOutput, repositoryRoot, runTsc } from './utils';

/** The plugin modules of the README's examples, by the file name that their first line gives. */
const examples = new Map(
	[
		...fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8').matchAll(
			/^```js\n(\/\/ ([\w-]+\.js)\b.*?)^```$/gms,
		),
	]
		.map(([, source, fileName]) => [fileName!, source!]),
);

function generateWith(example: string, fileName: string, content: string) {
	const source = examples.get(example);
	expect(source).toBeTypeOf('string');
	const module: { exports: { codegen?: VueCodegenPlugin } } = { exports: {} };
	new Function('exports', 'require', source!)(module.exports, require);
	const { plugins } = loadCodegenPlugins(
		{ plugins: [{ name: example, config: {}, module: module.exports }] } as never,
	);
	return generate(fileName, content, undefined, plugins);
}

/** The diagnostics of a project of `files` whose mapper loads the plugin of `example`. */
function check(example: string, files: Record<string, string>) {
	const workspace = fs.mkdtempSync(path.join(repositoryRoot, 'test-workspace', '.readme-'));
	try {
		fs.mkdirSync(path.join(workspace, 'node_modules/@vue'), { recursive: true });
		fs.symlinkSync(
			path.join(repositoryRoot, 'packages/language-core'),
			path.join(workspace, 'node_modules/@vue/language-core'),
			'junction',
		);
		fs.writeFileSync(path.join(workspace, example), examples.get(example)!);
		fs.writeFileSync(
			path.join(workspace, 'tsconfig.json'),
			JSON.stringify({
				extends: '../tsconfig.base.json',
				compilerOptions: { strict: true },
				contentMappers: [{
					package: '@vue/content-mapper',
					extensions: ['.vue'],
					options: { languageFeatures: false, plugins: [`./${example}`] },
				}],
				include: ['*.vue'],
			}),
		);
		for (const [fileName, content] of Object.entries(files)) {
			fs.writeFileSync(path.join(workspace, fileName), content);
		}
		const output = normalizeCompilerOutput(
			runTsc(['-p', path.join(workspace, 'tsconfig.json'), '--runExternalCode', '--pretty', 'false']),
		);
		return output.replaceAll(path.relative(repositoryRoot, workspace).replaceAll('\\', '/'), '<workspace>');
	}
	finally {
		fs.rmSync(workspace, { recursive: true, force: true });
	}
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

test('define-prop.js moves the type argument of the macro into a prop, which the template reads', () => {
	const content = `<script setup lang="ts">\ndefineProp<number>('count');\n</script>\n`
		+ `<template>{{ count.toFixed() }}</template>\n`;
	const { text, mappings } = generateWith('define-prop.js', '/Comp.vue', content);
	expect(text).not.toContain('defineProp');
	const type = text.indexOf('{ "count": number }') + '{ "count": '.length;
	expect(type).toBeGreaterThanOrEqual('{ "count": '.length);
	expect(text.split('number').length).toBe(2);
	expect(
		mappings.some(({ virtualStart, originalStart }) =>
			virtualStart === type && originalStart === content.indexOf('number')
		),
	).toBe(true);
	expect(check('define-prop.js', {
		'Comp.vue': content.replace('count.toFixed()', 'count.toFixed() + count.length'),
		'Parent.vue': `<script setup lang="ts">\nimport Comp from './Comp.vue';\n</script>\n`
			+ `<template><Comp :count="1" /><Comp count="1" /></template>\n`,
	})).toMatchInlineSnapshot(`
		"<workspace>/Comp.vue(4,38): error TS2339: Property 'length' does not exist on type 'number'.
		<workspace>/Parent.vue(4,36): error TS2322: Type 'string' is not assignable to type 'number'."
	`);
});
