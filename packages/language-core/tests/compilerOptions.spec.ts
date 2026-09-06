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

describe('CompilerOptionsResolver', () => {
	let tmpDir = '';

	afterEach(() => {
		if (tmpDir) {
			fs.rmSync(tmpDir, { recursive: true, force: true });
			tmpDir = '';
		}
	});

	it('deduplicates vueCompilerOptions.plugins by package name; last config wins', () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-plugin-dedupe-'));
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
});
