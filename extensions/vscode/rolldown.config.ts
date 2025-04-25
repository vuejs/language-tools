import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'rolldown';

export default defineConfig({
	input: {
		'client': './out/nodeClientMain.js',
		'server': './node_modules/@vue/language-server/node.ts',
		'../node_modules/vue-language-core-pack/index': './node_modules/@vue/language-core/index.ts',
		'../node_modules/vue-typescript-plugin-pack/index': './node_modules/@vue/typescript-plugin/index.ts',
	},
	output: {
		format: 'cjs',
		minify: process.argv.includes('--minify'),
	},
	define: {
		'process.env.NODE_ENV': '"production"',
	},
	external: ['vscode'],
	platform: 'node',
	plugins: [
		{
			name: 'umd2esm',
			resolveId(source, importer) {
				if (/^(vscode-.*-languageservice|vscode-languageserver-types|jsonc-parser)$/.test(source)) {
					const pathUmdMay = require.resolve(source, { paths: [importer!] });
					// Call twice the replace is to solve the problem of the path in Windows
					const pathEsm = pathUmdMay.replace('/umd/', '/esm/').replace('\\umd\\', '\\esm\\');
					return { id: pathEsm };
				}
			}
		},
		{
			name: 'resolve-share-module',
			resolveId(source) {
				if (source === '@vue/language-core') {
					return {
						id: 'vue-language-core-pack',
						external: true,
					};
				}
			},
		},
		{
			name: 'typescript-plugin-development',
			closeBundle() {
				if (!process.argv.includes('--minify')) {
					fs.writeFileSync(
						path.resolve(import.meta.dirname, './node_modules/vue-typescript-plugin-pack/index.js'),
						'module.exports = require(\'@vue/typescript-plugin\');'
					);
				}
			}
		},
		{
			name: 'schemas',
			closeBundle() {
				if (!fs.existsSync(path.resolve(import.meta.dirname, './dist/schemas'))) {
					fs.mkdirSync(path.resolve(import.meta.dirname, './dist/schemas'));
				}
				fs.cpSync(
					path.resolve(import.meta.dirname, './node_modules/@vue/language-core/schemas/vue-tsconfig.schema.json'),
					path.resolve(import.meta.dirname, './dist/schemas/vue-tsconfig.schema.json')
				);
			}
		},
	],
});