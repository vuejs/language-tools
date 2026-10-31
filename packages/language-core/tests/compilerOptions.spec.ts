import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createIRPipeline } from '../lib/ir/irPipeline';
import { createVueSource } from '../lib/ir/vueSource';
import { CompilerOptionsResolver, getDefaultCompilerOptions } from '../lib/options/compilerOptions';
import { loadIRPlugins } from '../lib/options/plugins';
import type { VueCompilerOptions } from '../lib/types';
import { createSnapshot, ts } from './typescript';

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
				pug: () => ({ pieces: [${JSON.stringify(`<${tag}/>`)}] }),
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

		expect(createIRPipeline(ts, vueCompilerOptions).compileTemplate('pug', '', {})?.result.ast.children[0])
			.toMatchObject({ tag: 'client' });
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

	it('adds the macro calls of the plugins to the macros of the options, creating each `ir` export once, and gives a file comment no plugins', () => {
		let created = 0;
		const resolver = new CompilerOptionsResolver(() => undefined);
		resolver.addConfig({ macros: { ...getDefaultCompilerOptions().macros, defineProps: ['myProps'] } }, '/project');
		resolver.plugins = [
			{
				name: 'a',
				file: '/project/a.js',
				config: {},
				module: { ir: () => (created++, { macros: { defineProps: ['$defineProps', 'myProps'] } }) },
			},
			{ name: 'b', file: '/project/b.js', config: {}, module: { ir: { macros: { defineEmits: ['$defineEmits'] } } } },
		];

		const vueCompilerOptions = resolver.build();
		expect(vueCompilerOptions.macros.defineProps).toEqual(['myProps', '$defineProps']);
		expect(vueCompilerOptions.macros.defineEmits).toEqual(['defineEmits', '$defineEmits']);
		expect(createIRPipeline(ts, vueCompilerOptions).errors).toEqual([]);
		expect(created).toBe(1);

		const source = createVueSource(
			ts,
			vueCompilerOptions,
			createIRPipeline(ts, vueCompilerOptions),
			'/project/App.vue',
			createSnapshot(`<script setup lang="ts">\nconst props = $defineProps<{ a: string }>();\n</script>\n`),
		);
		expect(source.analysis.getScriptSetupRanges()?.defineProps?.name).toBe('props');

		const commented = createVueSource(
			ts,
			vueCompilerOptions,
			createIRPipeline(ts, vueCompilerOptions),
			'/project/App.vue',
			createSnapshot(
				`<!-- @plugins ["./evil.js"] -->\n<!-- @macros { "defineEmits": ["myEmits"] } -->\n`
					+ `<script setup lang="ts">\nconst props = $defineProps<{ a: string }>();\n</script>\n`,
			),
		);
		const commentOptions = commented.analysis.getResolvedOptions();
		expect(commentOptions).not.toBe(vueCompilerOptions);
		expect(commentOptions.plugins).toEqual([]);
		expect(commentOptions.macros.defineProps).toEqual(['myProps', '$defineProps']);
		expect(commentOptions.macros.defineEmits).toEqual(['myEmits']);
		expect(commented.analysis.getScriptSetupRanges()?.defineProps?.name).toBe('props');
		expect(created).toBe(1);
	});

	it('reports the macro calls of a plugin that name no macro or are not a list of names', () => {
		const resolver = new CompilerOptionsResolver(() => undefined);
		resolver.plugins = [{
			name: 'bad',
			file: '/project/bad.js',
			config: {},
			module: { ir: { macros: { defineFoo: ['$defineFoo'], defineProps: '$defineProps', defineEmits: [1] } } },
		}];

		const vueCompilerOptions = resolver.build();
		expect(vueCompilerOptions.macros).toEqual(new CompilerOptionsResolver(() => undefined).build().macros);
		expect(createIRPipeline(ts, vueCompilerOptions).errors).toEqual([
			{ plugin: 'bad', message: `'defineFoo' is not a macro.` },
			{ plugin: 'bad', message: `The calls of the macro 'defineProps' are not a list of names.` },
			{ plugin: 'bad', message: `The calls of the macro 'defineEmits' are not a list of names.` },
		]);
	});
});
