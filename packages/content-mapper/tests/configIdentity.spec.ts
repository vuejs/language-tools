import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { OptionDiagnosticCode } from '../optionDiagnostics';
import { closeProject, openProject } from '../project';
import type { MapperOptions } from '../protocol';

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vue-config-identity-')));
let nextHandle = 0;

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

function createProject(name: string, files: Record<string, string>) {
	const dir = path.join(root, name);
	for (const [fileName, content] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(dir, fileName)), { recursive: true });
		fs.writeFileSync(path.join(dir, fileName), content);
	}
	return path.join(dir, 'tsconfig.json');
}

function open(configFileName: string, options?: MapperOptions) {
	const projectHandle = `identity-${nextHandle++}`;
	const opened = openProject({ configFileName, projectHandle, compilerOptions: {}, options });
	closeProject(projectHandle);
	return opened;
}

const vuePackage = (version: string) => JSON.stringify({ name: 'vue', version });
const plugin = (name: string) => `exports.ir = {}; // ${name}\n`;

test('projects with different tsconfig files but the same effective options share an identity', () => {
	const a = createProject('same-a', {
		'tsconfig.json': '{ "compilerOptions": { "strict": true } }',
		'node_modules/vue/package.json': vuePackage('3.5.0'),
	});
	const b = createProject('same-b', {
		'tsconfig.json': '{ "extends": "./base.json", "include": ["src"] }',
		'base.json': '{ "compilerOptions": { "strict": false } }',
		'node_modules/vue/package.json': vuePackage('3.5.13'),
	});
	const openedA = open(a, { strictTemplates: true });
	const openedB = open(b, { strictTemplates: true });

	expect(openedA.configIdentity).toBe(openedB.configIdentity);
	expect(openedA.watchedFiles).toEqual([path.join(path.dirname(a), 'node_modules/vue/package.json')]);
	expect(openedB.watchedFiles).toEqual([path.join(path.dirname(b), 'node_modules/vue/package.json')]);
});

test('an effective option that differs gives another identity', () => {
	const vue35 = createProject('target-35', {
		'tsconfig.json': '{}',
		'node_modules/vue/package.json': vuePackage('3.5.0'),
	});
	const vue34 = createProject('target-34', {
		'tsconfig.json': '{}',
		'node_modules/vue/package.json': vuePackage('3.4.0'),
	});
	expect(open(vue35).configIdentity).not.toBe(open(vue34).configIdentity);

	// Equal entry options, but `typesRoot` resolves relative to each project.
	const typesA = createProject('types-a', { 'tsconfig.json': '{}' });
	const typesB = createProject('types-b', { 'tsconfig.json': '{}' });
	expect(open(typesA, { target: 3.5, typesRoot: './types' }).configIdentity)
		.not.toBe(open(typesB, { target: 3.5, typesRoot: './types' }).configIdentity);

	expect(open(vue35, { strictTemplates: true }).configIdentity).not.toBe(open(vue35).configIdentity);
});

test('a plugin file that differs gives another identity', () => {
	const options = { target: 3.5, plugins: ['./plugin.cjs'] };
	const a = createProject('plugin-a', { 'tsconfig.json': '{}', 'plugin.cjs': plugin('same') });
	const b = createProject('plugin-b', { 'tsconfig.json': '{}', 'plugin.cjs': plugin('same') });
	const identity = open(a, options).configIdentity;
	expect(open(b, options).configIdentity).toBe(identity);

	fs.writeFileSync(path.join(path.dirname(b), 'plugin.cjs'), plugin('changed'));
	const opened = open(b, options);
	expect(opened.configIdentity).not.toBe(identity);
	expect(opened.watchedFiles).toEqual([path.join(path.dirname(b), 'plugin.cjs')]);
});

test('a plugin file that fails to load is still watched and fingerprinted', () => {
	const options = { target: 3.5, plugins: ['./plugin.cjs'] };
	const configFileName = createProject('plugin-broken', {
		'tsconfig.json': '{}',
		'plugin.cjs': `throw new Error('broken plugin');\n`,
	});
	const pluginFile = path.join(path.dirname(configFileName), 'plugin.cjs');
	const broken = open(configFileName, options);
	expect(broken.watchedFiles).toEqual([pluginFile]);

	fs.writeFileSync(pluginFile, `throw new Error('still broken');\n`);
	expect(open(configFileName, options).configIdentity).not.toBe(broken.configIdentity);
});

test('a plugin package that differs in version gives another identity', () => {
	const options = { target: 3.5, plugins: ['vue-plugin'] };
	const pluginPackage = (version: string) => JSON.stringify({ name: 'vue-plugin', version, main: 'index.js' });
	const configFileName = createProject('plugin-version', {
		'tsconfig.json': '{}',
		'node_modules/vue-plugin/package.json': pluginPackage('1.0.0'),
		'node_modules/vue-plugin/index.js': plugin('same'),
	});
	const packageJson = path.join(path.dirname(configFileName), 'node_modules/vue-plugin/package.json');
	const first = open(configFileName, options);
	expect(first.watchedFiles).toContain(packageJson);

	fs.writeFileSync(packageJson, JSON.stringify({ ...JSON.parse(pluginPackage('1.0.0')), description: 'same' }));
	expect(open(configFileName, options).configIdentity).toBe(first.configIdentity);

	fs.writeFileSync(packageJson, pluginPackage('1.0.1'));
	expect(open(configFileName, options).configIdentity).not.toBe(first.configIdentity);
});

test('plugins that fail to load are reported as option diagnostics', () => {
	const configFileName = createProject('plugin-diagnostics', {
		'tsconfig.json': '{}',
		'legacy.cjs': `module.exports = () => ({ version: 4 });\n`,
		'pug-a.cjs': `exports.ir = { templateCompilers: { pug: () => undefined } };\n`,
		'pug-b.cjs': `exports.ir = { templateCompilers: { pug: () => undefined } };\n`,
	});
	const opened = open(configFileName, {
		target: 3.5,
		format: 'custom',
		plugins: ['./missing.cjs', { name: './legacy.cjs' }, './pug-a.cjs', './pug-b.cjs'],
	});
	expect(opened.optionDiagnostics).toEqual([
		{
			path: ['plugins', 0],
			messageText: `Plugin './missing.cjs': Cannot find the plugin from '${
				path.dirname(configFileName).replace(/\\/g, '/')
			}'.`,
			code: OptionDiagnosticCode.InvalidPlugin,
		},
		{
			path: ['plugins', 1],
			messageText:
				`Plugin './legacy.cjs': VueLanguagePlugin functions are no longer supported; export \`{ ir: … }\` (see language-core README)`,
			code: OptionDiagnosticCode.InvalidPlugin,
		},
		{
			path: ['plugins', 3],
			messageText: `Plugin './pug-b.cjs': The template compiler 'pug' is already provided by './pug-a.cjs'.`,
			code: OptionDiagnosticCode.InvalidPlugin,
		},
		{
			path: ['format'],
			messageText: `No format 'custom' is built in or provided by a plugin; 'sfc' is used instead.`,
			code: OptionDiagnosticCode.InvalidOptionType,
		},
	]);
});
