import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createIRPipeline } from '../lib/ir/irPipeline';
import { CompilerOptionsResolver } from '../lib/options/compilerOptions';
import { loadIRPlugins } from '../lib/options/plugins';
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
		`exports.ir = {
			templateCompilers: {
				pug: () => ({
					ast: { tag: ${JSON.stringify(tag)} },
					code: '',
					preamble: '',
				}),
			},
		};`,
	);
}

/** A plugin package that provides a template compiler of each of `langs`. */
function writeNamedPluginPackage(rootDir: string, specifier: string, langs: string[]) {
	const packageDir = path.join(rootDir, 'node_modules', specifier);
	fs.mkdirSync(packageDir, { recursive: true });
	fs.writeFileSync(
		path.join(packageDir, 'package.json'),
		JSON.stringify({ name: specifier, main: 'index.js' }),
	);
	fs.writeFileSync(
		path.join(packageDir, 'index.js'),
		`exports.ir = {\n\ttemplateCompilers: {\n${
			langs.map(lang => `\t\t${JSON.stringify(lang)}: () => undefined,\n`).join('')
		}\t},\n};`,
	);
}

/** The template languages that the plugins of `vueCompilerOptions` provide. */
function templateLangs(vueCompilerOptions: VueCompilerOptions) {
	return Object.keys(loadIRPlugins(vueCompilerOptions, { formats: [], templateCompilers: [] }).templateCompilers);
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

		expect(createIRPipeline(ts, vueCompilerOptions).compileTemplate('pug', '', {})?.result).toEqual({
			ast: { tag: 'client' },
			code: '',
			preamble: '',
		});
	});

	it('drops every plugin inherited from the extended configs', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-replace-'));
		const baseDir = path.join(tmpDir, 'base');
		const appDir = path.join(tmpDir, 'app');
		writeNamedPluginPackage(baseDir, '@fixture/base', ['base']);
		writeNamedPluginPackage(appDir, '@fixture/app', ['app']);

		const resolver = new CompilerOptionsResolver(() => undefined);
		resolver.addConfig({ plugins: ['@fixture/base'] }, baseDir);
		resolver.addConfig({ plugins: ['@fixture/app'] }, appDir);

		const vueCompilerOptions = resolver.build();
		expect(vueCompilerOptions.plugins.map(plugin => plugin.name)).toEqual(['@fixture/app']);
		expect(templateLangs(vueCompilerOptions)).toEqual(['app']);
	});

	it('keeps the inherited plugins when a config does not declare them', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-inherit-'));
		const baseDir = path.join(tmpDir, 'base');
		const appDir = path.join(tmpDir, 'app');
		writeNamedPluginPackage(baseDir, '@fixture/base', ['base']);

		const resolver = new CompilerOptionsResolver(() => undefined);
		resolver.addConfig({ plugins: ['@fixture/base'] }, baseDir);
		resolver.addConfig({ jsxSlots: true }, appDir);

		const vueCompilerOptions = resolver.build();
		expect(vueCompilerOptions.plugins.map(plugin => plugin.name)).toEqual(['@fixture/base']);
		expect(templateLangs(vueCompilerOptions)).toEqual(['base']);
		expect(vueCompilerOptions.jsxSlots).toBe(true);
	});

	it('clears the inherited plugins with an empty array', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-clear-'));
		const baseDir = path.join(tmpDir, 'base');
		const appDir = path.join(tmpDir, 'app');
		writeNamedPluginPackage(baseDir, '@fixture/base', ['base']);

		const resolver = new CompilerOptionsResolver(() => undefined);
		resolver.addConfig({ plugins: ['@fixture/base'] }, baseDir);
		resolver.addConfig({ plugins: [] }, appDir);

		expect(resolver.build().plugins).toEqual([]);
	});

	it('keeps every template compiler provided by a single module', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-multi-'));
		writeNamedPluginPackage(tmpDir, '@fixture/multi', ['first', 'second']);

		const resolver = new CompilerOptionsResolver(() => undefined);
		resolver.addConfig({ plugins: ['@fixture/multi'] }, tmpDir);

		const vueCompilerOptions = resolver.build();
		expect(vueCompilerOptions.plugins.map(plugin => plugin.name)).toEqual(['@fixture/multi']);
		expect(templateLangs(vueCompilerOptions)).toEqual(['first', 'second']);
	});

	it('passes the entry without its name to the `ir` export as its config', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-config-'));
		const packageDir = path.join(tmpDir, 'node_modules', '@fixture/config');
		fs.mkdirSync(packageDir, { recursive: true });
		fs.writeFileSync(
			path.join(packageDir, 'index.js'),
			`exports.ir = ({ config }) => ({ templateCompilers: { [JSON.stringify(config)]: () => undefined } });`,
		);

		const resolver = new CompilerOptionsResolver(() => undefined);
		resolver.addConfig({ plugins: [{ name: '@fixture/config', foo: 1 }] }, tmpDir);

		const vueCompilerOptions = resolver.build();
		expect(vueCompilerOptions.plugins.map(({ name, config }) => ({ name, config }))).toEqual([
			{ name: '@fixture/config', config: { foo: 1 } },
		]);
		expect(templateLangs(vueCompilerOptions)).toEqual([JSON.stringify({ foo: 1 })]);
	});

	it('has no plugins when no config declares them', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-none-'));

		const resolver = new CompilerOptionsResolver(() => undefined);
		resolver.addConfig({ jsxSlots: true }, tmpDir);

		expect(resolver.build().plugins).toEqual([]);
	});
});
