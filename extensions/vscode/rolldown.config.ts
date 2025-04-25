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
		sourcemap: process.argv.includes('--watch'),
	},
	define: {
		'process.env.NODE_ENV': '"production"',
	},
	external: ['vscode'],
	platform: 'node',
	plugins: [
		{
			name: 'umd2esm',
			resolveId: {
				filter: {
					id: /^(vscode-.*-languageservice|vscode-languageserver-types|jsonc-parser)$/
				},
				handler(source, importer) {
					const pathUmdMay = require.resolve(source, { paths: [importer!] });
					// Call twice the replace is to solve the problem of the path in Windows
					const pathEsm = pathUmdMay.replace('/umd/', '/esm/').replace('\\umd\\', '\\esm\\');
					return { id: pathEsm };
				},
			},
		},
		{
			name: 'clean',
			buildStart() {
				try {
					fs.rmSync(path.resolve(__dirname, './dist'), { recursive: true });
					fs.rmSync(path.resolve(__dirname, './node_modules/vue-typescript-plugin-pack'), { recursive: true });
				}
				catch { }
			},
		},
		{
			name: 'schemas',
			buildEnd() {
				fs.cpSync(
					path.resolve(__dirname, './node_modules/@vue/language-core/schemas/vue-tsconfig.schema.json'),
					path.resolve(__dirname, './dist/schemas/vue-tsconfig.schema.json'),
					{ recursive: true }
				);
			},
		},
	],
});
