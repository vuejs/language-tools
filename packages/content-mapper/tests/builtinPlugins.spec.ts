import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { builtinPlugins } from '../lib/codegen';
import { normalizeCompilerOutput, repositoryRoot, runTsc } from './utils';

const packageRoot = path.resolve(__dirname, '..');
const fixture = path.join(repositoryRoot, 'test-workspace/content-mapper-builtins');
const mapperOptions = { languageFeatures: false, target: 99, fallthroughAttributes: true };

/**
 * `run` in a workspace beside the fixture, with a copy of the built mapper that runs without the built-in plugin
 * `disabled`.
 */
function withMapper<T>(disabled: string | undefined, run: (workspace: string, mapper: string) => T): T {
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
		return run(workspace, copy);
	}
	finally {
		fs.rmSync(workspace, { recursive: true, force: true });
	}
}

/** The diagnostics of the fixture through the mapper. */
function check(disabled?: string) {
	return withMapper(disabled, workspace => {
		fs.writeFileSync(
			path.join(workspace, 'tsconfig.json'),
			JSON.stringify({
				extends: '../tsconfig.base.json',
				compilerOptions: { strict: true },
				contentMappers: [{ package: '@vue/content-mapper', extensions: ['.vue'], options: mapperOptions }],
				include: [path.relative(workspace, fixture).replaceAll('\\', '/') + '/*.vue'],
			}),
		);
		return normalizeCompilerOutput(
			runTsc(['-p', path.join(workspace, 'tsconfig.json'), '--runExternalCode', '--pretty', 'false']),
		);
	});
}

/**
 * Writes the virtual code of each file of the fixture, by the mapper of a copy, into a workspace beside the fixture, so
 * that its references resolve the same, and `./X.vue` is `X.vue.ts`. It runs in a process of its own: a mapper run in
 * the process of the tests, which the tests share, breaks the definitions of the language server tests after it.
 */
const transformFixture = `
const fs = require('node:fs');
const path = require('node:path');
const [mapper, fixture, workspace, configFileName, options] = process.argv.slice(1);
const { createContentMapper } = require(path.join(mapper, 'lib/mapper/contentMapper.js'));
const contentMapper = createContentMapper({ name: 'builtins' });
contentMapper.openProject({ projectHandle: 'builtins', configFileName, compilerOptions: {}, options: JSON.parse(options) });
for (const name of fs.readdirSync(fixture).filter(name => name.endsWith('.vue'))) {
	const fileName = path.join(fixture, name);
	const content = fs.readFileSync(fileName, 'utf8');
	const { text, extension } = contentMapper.transform({ projectHandle: 'builtins', fileName, content });
	fs.writeFileSync(path.join(workspace, name + extension), text);
}
process.exit();
`;

/**
 * The diagnostics of the virtual code of the fixture as plain TypeScript files, with all of them: the mapper drops
 * those at code that maps to no source, such as a declaration that no code reads.
 */
function checkVirtualCode(disabled?: string) {
	return withMapper(disabled, (workspace, mapper) => {
		const configFileName = path.join(workspace, 'tsconfig.json');
		fs.writeFileSync(
			configFileName,
			JSON.stringify({
				extends: '../tsconfig.base.json',
				compilerOptions: { strict: true, noUnusedLocals: true, noUnusedParameters: true },
				contentMappers: [],
				include: ['*.vue.ts'],
			}),
		);
		execFileSync(process.execPath, [
			'-e',
			transformFixture,
			mapper,
			fixture,
			workspace,
			configFileName,
			JSON.stringify(mapperOptions),
		]);
		return normalizeCompilerOutput(runTsc(['-p', configFileName, '--pretty', 'false']))
			.split('\n')
			.filter(Boolean)
			.map(line => line.replace(/^test-workspace\/\.builtins-[^/]+\/(.*?)\(\d+,\d+\)(: error TS\d+: .*)$/, '$1$2'));
	});
}

/**
 * The declarations of the user's code that only the code of a plugin reads, which the virtual code without it does not
 * read, by the plugin.
 */
const acceptedUnread: Record<string, string[]> = {
	// what `v-bind()` in CSS reads
	'vue:style': [`Refs.vue.ts: error TS6133: 'color' is declared but its value is never read.`],
};

/**
 * The diagnostics that the fixture gets without a plugin that accepts what it reads, by the plugin: without the plugin,
 * the code that reads what the plugin declares is rejected, as without the declaration.
 */
const accepted: Record<string, string[]> = {
	// the attributes of the root, which the component takes as props, and with required fallthrough attributes, the
	// required props of the root that the parent passes, which the root then misses
	'vue:inherited-attrs': [
		'Parent.vue(26,17): error TS2353',
		'RequiredParent.vue(6,17): error TS2353',
		'RequiredRoot.vue(9,3): error TS2345',
	],
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
		'RequiredParent.vue(6,17): error TS2353',
	],
	// the models that `defineModel` declares, which a parent binds
	'vue:model': ['Parent.vue(19,9): error TS2353', 'Parent.vue(23,36): error TS2353', 'Parent.vue(26,39): error TS2353'],
};

test.each([undefined, ...builtinPlugins.map(({ name }) => name)])(
	'type checks the fixture without the built-in plugin %s, which drops only its checks',
	disabled => {
		// the first line of each diagnostic, without the lines that go on with its message
		const diagnostics = check(disabled).split('\n').filter(line => line && !/^\s/.test(line)).map(line =>
			line.replace(/^test-workspace\/content-mapper-builtins\/(.*?error TS\d+).*$/, '$1')
		);
		expect(diagnostics).toEqual(accepted[disabled!] ?? []);
	},
);

test.each([undefined, ...builtinPlugins.map(({ name }) => name)])(
	'the virtual code of the fixture without the built-in plugin %s declares nothing that no code reads',
	disabled => {
		expect(checkVirtualCode(disabled).filter(line => /: error TS(?:6133|6138|6192|6196|6198|6199|6205):/.test(line)))
			.toEqual(acceptedUnread[disabled!] ?? []);
	},
);
