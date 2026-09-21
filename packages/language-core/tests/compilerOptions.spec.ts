import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';
import { CompilerOptionsResolver } from '../lib/compilerOptions';
import { createPlugins } from '../lib/plugins';

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
			version: 2.2,
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
		.map(name => `function ${name}() {\n\treturn { name: ${JSON.stringify(name)}, version: 2.2 };\n}`)
		.join(',\n');
	fs.writeFileSync(
		path.join(packageDir, 'index.js'),
		factoryNames.length > 1
			? `module.exports = [\n${factories}\n];`
			: `${factories}\nmodule.exports = ${factoryNames[0]};`,
	);
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

		const resolver = new CompilerOptionsResolver(ts, () => undefined);
		resolver.addConfig({ plugins: [PLUGIN_NAME] }, layerDir);
		resolver.addConfig({ plugins: [PLUGIN_NAME] }, clientDir);

		const vueCompilerOptions = resolver.build();
		expect(vueCompilerOptions.plugins).toHaveLength(1);

		const instances = createPlugins({
			modules: {
				'@vue/compiler-dom': {} as any,
				'@vue/language-core': {} as any,
				typescript: ts,
			},
			compilerOptions: {},
			vueCompilerOptions,
			config: {},
		});
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

		const resolver = new CompilerOptionsResolver(ts, () => undefined);
		resolver.addConfig({ plugins: ['@fixture/base'] }, baseDir);
		resolver.addConfig({ plugins: ['@fixture/app'] }, appDir);

		expect(resolver.build().plugins.map(plugin => plugin.name)).toEqual(['appPlugin']);
	});

	it('keeps the inherited plugins when a config does not declare them', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-inherit-'));
		const baseDir = path.join(tmpDir, 'base');
		const appDir = path.join(tmpDir, 'app');
		writeNamedPluginPackage(baseDir, '@fixture/base', ['basePlugin']);

		const resolver = new CompilerOptionsResolver(ts, () => undefined);
		resolver.addConfig({ plugins: ['@fixture/base'] }, baseDir);
		resolver.addConfig({ strictTemplates: true }, appDir);

		const vueCompilerOptions = resolver.build();
		expect(vueCompilerOptions.plugins.map(plugin => plugin.name)).toEqual(['basePlugin']);
		expect(vueCompilerOptions.checkUnknownProps).toBe(true);
	});

	it('clears the inherited plugins with an empty array', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-clear-'));
		const baseDir = path.join(tmpDir, 'base');
		const appDir = path.join(tmpDir, 'app');
		writeNamedPluginPackage(baseDir, '@fixture/base', ['basePlugin']);

		const resolver = new CompilerOptionsResolver(ts, () => undefined);
		resolver.addConfig({ plugins: ['@fixture/base'] }, baseDir);
		resolver.addConfig({ plugins: [] }, appDir);

		expect(resolver.build().plugins).toEqual([]);
	});

	it('keeps every plugin exported by a single module', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-array-'));
		writeNamedPluginPackage(tmpDir, '@fixture/multi', ['firstPlugin', 'secondPlugin']);

		const resolver = new CompilerOptionsResolver(ts, () => undefined);
		resolver.addConfig({ plugins: ['@fixture/multi'] }, tmpDir);

		expect(resolver.build().plugins.map(plugin => plugin.name)).toEqual(['firstPlugin', 'secondPlugin']);
	});

	it('has no plugins when no config declares them', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-none-'));

		const resolver = new CompilerOptionsResolver(ts, () => undefined);
		resolver.addConfig({ strictTemplates: true }, tmpDir);

		expect(resolver.build().plugins).toEqual([]);
	});
});
