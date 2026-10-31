import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { builtinPlugins } from '../lib/codegen';
import { normalizeCompilerOutput, repositoryRoot, runTsc } from './utils';

const packageRoot = path.resolve(__dirname, '..');
const fixture = path.join(repositoryRoot, 'test-workspace/content-mapper-builtins');

/**
 * The diagnostics of the fixture with a copy of the built mapper that runs without the built-in plugin `disabled`.
 */
function check(disabled?: string) {
	const workspace = fs.mkdtempSync(path.join(repositoryRoot, 'test-workspace', '.builtins-'));
	try {
		const copy = path.join(workspace, 'node_modules/@vue/content-mapper');
		fs.cpSync(packageRoot, copy, {
			recursive: true,
			filter: source => {
				const relative = path.relative(packageRoot, source);
				return !/^(?:node_modules|tests|scripts)(?:[\\/]|$)/.test(relative)
					&& (fs.statSync(source).isDirectory() || /\.js$|^package\.json$/.test(relative));
			},
		});
		fs.symlinkSync(path.join(packageRoot, 'node_modules'), path.join(copy, 'node_modules'), 'junction');
		if (disabled) {
			const index = path.join(copy, 'lib/codegen/index.js');
			const code = fs.readFileSync(index, 'utf8');
			const entry = new RegExp(`\\{ name: '${disabled}', create: [\\w.]+ \\},\\n`);
			expect(code).toMatch(entry);
			fs.writeFileSync(index, code.replace(entry, ''));
		}
		fs.writeFileSync(
			path.join(workspace, 'tsconfig.json'),
			JSON.stringify({
				extends: '../tsconfig.base.json',
				compilerOptions: { strict: true },
				contentMappers: [{
					package: '@vue/content-mapper',
					extensions: ['.vue'],
					options: { languageFeatures: false, target: 99, fallthroughAttributes: true },
				}],
				include: [path.relative(workspace, fixture).replaceAll('\\', '/') + '/*.vue'],
			}),
		);
		return normalizeCompilerOutput(
			runTsc(['-p', path.join(workspace, 'tsconfig.json'), '--runExternalCode', '--pretty', 'false']),
		);
	}
	finally {
		fs.rmSync(workspace, { recursive: true, force: true });
	}
}

/**
 * The diagnostics that the fixture gets without a plugin that accepts what it reads, by the plugin: without the plugin,
 * the code that reads what the plugin declares is rejected, as without the declaration.
 */
const accepted: Record<string, string[]> = {
	// the attributes of the root, which the component takes as props
	'vue:inherited-attrs': ['Parent.vue(26,17): error TS2353'],
	// `$style`, and the reads of `v-bind()` in CSS
	'vue:style': ['Refs.vue(14,15): error TS2339', 'Refs.vue(6,7): error TS6133'],
	// the events that `defineEmits` declares: their listeners, and `$emit` of one beside the events of a model
	'vue:emits': [
		'InferredChild.vue(8,47): error TS2554',
		'Parent.vue(19,50): error TS2353',
		'Parent.vue(23,71): error TS2353',
		'Parent.vue(26,66): error TS2353',
	],
	// the props that `defineProps` declares: their reads in the template, and the props that a parent passes
	'vue:props': [
		'Child.vue(14,30): error TS2339',
		'Child.vue(14,42): error TS2339',
		'Child.vue(15,15): error TS2339',
		'Child.vue(17,39): error TS2339',
		'GenericChild.vue(10,22): error TS2339',
		'InferredChild.vue(8,22): error TS2339',
		'InferredChild.vue(8,31): error TS2339',
		'InferredChild.vue(9,29): error TS2339',
		'Parent.vue(19,25): error TS2353',
		'Parent.vue(23,55): error TS2353',
	],
};

test.each([undefined, ...builtinPlugins.map(({ name }) => name)])(
	'type checks the fixture without the built-in plugin %s, which drops only its checks',
	disabled => {
		const diagnostics = check(disabled).split('\n').filter(Boolean).map(line =>
			line.replace(/^test-workspace\/content-mapper-builtins\/(.*?error TS\d+).*$/, '$1')
		);
		expect(diagnostics).toEqual(accepted[disabled!] ?? []);
	},
);
