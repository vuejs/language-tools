import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SondaRollupPlugin } from 'sonda';
import { defineBuildConfig } from 'unbuild';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const languageServiceDataRE = /\/language-service\/data\/.*\.json$/;

export default defineBuildConfig([
	{
		entries: [
			{
				builder: 'rollup',
				input: 'src/nodeClientMain.ts',
				name: 'client',
			},
			{
				builder: 'rollup',
				input: './node_modules/@vue/language-server/node.ts',
				name: 'server',
			},
			{
				builder: 'rollup',
				input: './node_modules/@vue/typescript-plugin/index.ts',
				name: 'plugin',
			},
			{
				builder: 'copy',
				input: './node_modules/@vue/language-core/schemas',
				outDir: './dist/schemas',
			},
		],
		failOnWarn: false,
		outDir: 'dist',
		externals: ['vscode'],
		replace: {
			'globalThis.__VOLAR_DEV_FS__': 'undefined',
			'process.env.NODE_ENV': '"production"',
		},
		sourcemap: true,
		rollup: {
			emitCJS: true,
			esbuild: {
				target: 'ES2021',
			},
			commonjs: {
				transformMixedEsModules: true,
				exclude: [/\.json$/],
			},
			json: {
				compact: true,
				preferConst: true,
				exclude: languageServiceDataRE,
			},
			inlineDependencies: true,
		},
		stubOptions: {
			jiti: {
				alias: {
					vscode: join(__dirname, 'vscode-dev-shim.js'),
				},
				sourceMaps: true,
			},
		},
		hooks: {
			'rollup:options'(_ctx, options) {
				options.plugins = [
					// Load language-service data as `JSON.parse(serialized)`
					// See https://v8.dev/blog/cost-of-javascript-2019#json
					{
						name: 'language-service-data',
						transform: {
							order: 'pre',
							handler(code: string, id: string) {
								if (languageServiceDataRE.test(id.replaceAll('\\', '/'))) {
									const minimal = JSON.stringify(JSON.parse(code));
									const escaped = minimal.replaceAll(/[$`\\]/g, c => `\\${c}`);
									return {
										code: `export default JSON.parse(\`${escaped}\`)`,
										map: { mappings: '' },
									};
								}
							}
						}
					},

					SondaRollupPlugin(),

					...options.plugins,
				];

				// Only emit CJS
				if (!Array.isArray(options.output)) throw new Error('Unreachable');
				options.output = options.output.filter((option) => option.format === 'cjs');
				if (options.output.length !== 1) throw new Error('Unreachable');
			},

			'build:done'(ctx) {
				// Create the entry point for the TypeScript plugin
				const typescriptPluginRoot = join(__dirname, 'node_modules/vue-typescript-plugin-pack');
				mkdirSync(typescriptPluginRoot, { recursive: true });
				writeFileSync(join(typescriptPluginRoot, 'index.js'), 'module.exports = require("../../dist/plugin.cjs");');

				// Patch the stub files
				if (ctx.options.stub) {
					// Patch the stub file
					const stubFilePath = join(__dirname, 'dist/client.cjs');
					const originalStub = readFileSync(stubFilePath, 'utf-8');
					const newStub = [
						`globalThis.__VOLAR_DEV_VSCODE__ = require('vscode');`,
						`globalThis.__VOLAR_DEV_FS__ = require('node:fs');`,
						originalStub,
					].join('\n');
					writeFileSync(stubFilePath, newStub);
				}
			},
		},
	},
]);
