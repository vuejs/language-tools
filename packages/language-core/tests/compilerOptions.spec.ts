import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CompilerOptionsResolver } from '../lib/compilerOptions';
import { createPlugins } from '../lib/plugins';
import type { VueCompilerOptions } from '../lib/types';
import { ts } from './typescript';

const PLUGIN_NAME = '@fixture/vue-language-plugin-pug';

function writePluginPackage(rootDir: string, tag: string) {
	const packageDir = path.join(rootDir, 'node_modules', PLUGIN_NAME);
	fs.mkdirSync(packageDir, { recursive: true });
	fs.writeFileSync(
		path.join(packageDir, 'package.json'),
		JSON.stringify({ name: PLUGIN_NAME, main: 'index.js' }),
	);
	fs.writeFileSync(
		path.join(packageDir, 'index.js'),
		`module.exports = () => ({
			name: ${JSON.stringify(PLUGIN_NAME)},
			version: 4,
			compileSFCTemplate(lang) {
				if (lang === 'pug') {
					return {
						ast: { tag: ${JSON.stringify(tag)} },
						code: '',
						preamble: '',
					};
				}
			},
		});`,
	);
}

function writeNamedPluginPackage(rootDir: string, specifier: string, factoryNames: string[]) {
	const packageDir = path.join(rootDir, 'node_modules', specifier);
	fs.mkdirSync(packageDir, { recursive: true });
	fs.writeFileSync(
		path.join(packageDir, 'package.json'),
		JSON.stringify({ name: specifier, main: 'index.js' }),
	);
	const factories = factoryNames
		.map(name => `function ${name}() {\n\treturn { name: ${JSON.stringify(name)}, version: 4 };\n}`)
		.join(',\n');
	fs.writeFileSync(
		path.join(packageDir, 'index.js'),
		factoryNames.length > 1
			? `module.exports = [\n${factories}\n];`
			: `${factories}\nmodule.exports = ${factoryNames[0]};`,
	);
}

function createInstances(vueCompilerOptions: VueCompilerOptions) {
	return createPlugins({
		modules: {
			'@vue/compiler-dom': {} as any,
			'@vue/language-core': {} as any,
			typescript: ts,
		},
		vueCompilerOptions,
		config: {},
	});
}

/** The names of the instances of `vueCompilerOptions.plugins`; the built-in plugins have none. */
function instanceNames(vueCompilerOptions: VueCompilerOptions) {
	return createInstances(vueCompilerOptions).flatMap(plugin => plugin.name ?? []);
}

describe('CompilerOptionsResolver', () => {
	let tmpDir = '';

	afterEach(() => {
		if (tmpDir) {
			fs.rmSync(tmpDir, { recursive: true, force: true });
			tmpDir = '';
		}
	});

	it('replaces the inherited plugins with the ones declared by the last config', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-override-'));
		const layerDir = path.join(tmpDir, 'layer');
		const clientDir = path.join(tmpDir, 'client');
		fs.mkdirSync(layerDir);
		fs.mkdirSync(clientDir);

		writePluginPackage(layerDir, 'base');
		writePluginPackage(clientDir, 'client');

		const resolver = new CompilerOptionsResolver(() => undefined);
		resolver.addConfig({ plugins: [PLUGIN_NAME] }, layerDir);
		resolver.addConfig({ plugins: [PLUGIN_NAME] }, clientDir);

		const vueCompilerOptions = resolver.build();
		expect(vueCompilerOptions.plugins).toHaveLength(1);
		expect(vueCompilerOptions.plugins[0]!.file).toBe(
			fs.realpathSync(path.join(clientDir, 'node_modules', PLUGIN_NAME, 'index.js')),
		);

		const instances = createInstances(vueCompilerOptions);
		const pugPlugin = instances.find(plugin => plugin.name === PLUGIN_NAME);

		expect(pugPlugin?.compileSFCTemplate?.('pug', '', {})).toEqual({
			ast: { tag: 'client' },
			code: '',
			preamble: '',
		});
	});

	it('drops every plugin inherited from the extended configs', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-replace-'));
		const baseDir = path.join(tmpDir, 'base');
		const appDir = path.join(tmpDir, 'app');
		writeNamedPluginPackage(baseDir, '@fixture/base', ['basePlugin']);
		writeNamedPluginPackage(appDir, '@fixture/app', ['appPlugin']);

		const resolver = new CompilerOptionsResolver(() => undefined);
		resolver.addConfig({ plugins: ['@fixture/base'] }, baseDir);
		resolver.addConfig({ plugins: ['@fixture/app'] }, appDir);

		const vueCompilerOptions = resolver.build();
		expect(vueCompilerOptions.plugins.map(plugin => plugin.name)).toEqual(['@fixture/app']);
		expect(instanceNames(vueCompilerOptions)).toEqual(['appPlugin']);
	});

	it('keeps the inherited plugins when a config does not declare them', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-inherit-'));
		const baseDir = path.join(tmpDir, 'base');
		const appDir = path.join(tmpDir, 'app');
		writeNamedPluginPackage(baseDir, '@fixture/base', ['basePlugin']);

		const resolver = new CompilerOptionsResolver(() => undefined);
		resolver.addConfig({ plugins: ['@fixture/base'] }, baseDir);
		resolver.addConfig({ jsxSlots: true }, appDir);

		const vueCompilerOptions = resolver.build();
		expect(vueCompilerOptions.plugins.map(plugin => plugin.name)).toEqual(['@fixture/base']);
		expect(instanceNames(vueCompilerOptions)).toEqual(['basePlugin']);
		expect(vueCompilerOptions.jsxSlots).toBe(true);
	});

	it('clears the inherited plugins with an empty array', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-clear-'));
		const baseDir = path.join(tmpDir, 'base');
		const appDir = path.join(tmpDir, 'app');
		writeNamedPluginPackage(baseDir, '@fixture/base', ['basePlugin']);

		const resolver = new CompilerOptionsResolver(() => undefined);
		resolver.addConfig({ plugins: ['@fixture/base'] }, baseDir);
		resolver.addConfig({ plugins: [] }, appDir);

		expect(resolver.build().plugins).toEqual([]);
	});

	it('keeps every plugin exported by a single module', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-array-'));
		writeNamedPluginPackage(tmpDir, '@fixture/multi', ['firstPlugin', 'secondPlugin']);

		const resolver = new CompilerOptionsResolver(() => undefined);
		resolver.addConfig({ plugins: ['@fixture/multi'] }, tmpDir);

		const vueCompilerOptions = resolver.build();
		expect(vueCompilerOptions.plugins.map(plugin => plugin.name)).toEqual(['@fixture/multi']);
		expect(instanceNames(vueCompilerOptions)).toEqual(['firstPlugin', 'secondPlugin']);
	});

	it('passes the entry without its name to the plugin as its config', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-config-'));
		const packageDir = path.join(tmpDir, 'node_modules', '@fixture/config');
		fs.mkdirSync(packageDir, { recursive: true });
		fs.writeFileSync(
			path.join(packageDir, 'index.js'),
			`module.exports = ({ config }) => ({ version: 4, name: JSON.stringify(config) });`,
		);

		const resolver = new CompilerOptionsResolver(() => undefined);
		resolver.addConfig({ plugins: [{ name: '@fixture/config', foo: 1 }] }, tmpDir);

		const vueCompilerOptions = resolver.build();
		expect(vueCompilerOptions.plugins.map(({ name, config }) => ({ name, config }))).toEqual([
			{ name: '@fixture/config', config: { foo: 1 } },
		]);
		expect(instanceNames(vueCompilerOptions)).toEqual([JSON.stringify({ name: '@fixture/config', foo: 1 })]);
	});

	it('has no plugins when no config declares them', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-none-'));

		const resolver = new CompilerOptionsResolver(() => undefined);
		resolver.addConfig({ jsxSlots: true }, tmpDir);

		expect(resolver.build().plugins).toEqual([]);
	});
});
