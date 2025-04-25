import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig } from 'rolldown';

export default defineConfig({
	input: {
		'client': './src/nodeClientMain.ts',
		'server': './node_modules/@vue/language-server/node.ts',
		'../node_modules/vue-typescript-plugin-pack/index': './node_modules/@vue/typescript-plugin/index.ts',
	},
	output: {
		format: 'cjs',
		minify: process.argv.includes('--minify'),
		sourcemap: !process.argv.includes('--minify')
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
			name: 'typescript-plugin-development',
			closeBundle() {
				if (!process.argv.includes('--minify')) {
					fs.writeFileSync(
						path.resolve(__dirname, './node_modules/vue-typescript-plugin-pack/index.js'),
						'module.exports = require(\'@vue/typescript-plugin\');'
					);
				}
			}
		},
		{
			name: 'schemas',
			closeBundle() {
				if (!fs.existsSync(path.resolve(__dirname, './dist/schemas'))) {
					fs.mkdirSync(path.resolve(__dirname, './dist/schemas'));
				}
				fs.cpSync(
					path.resolve(__dirname, './node_modules/@vue/language-core/schemas/vue-tsconfig.schema.json'),
					path.resolve(__dirname, './dist/schemas/vue-tsconfig.schema.json')
				);
			}
		},
	],
});