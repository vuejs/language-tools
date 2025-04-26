import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig } from 'rolldown';

const resolve = (...paths: string[]) => path.resolve(__dirname, ...paths);

export default defineConfig({
	input: {
		'client': './src/nodeClientMain.ts',
		'server': './node_modules/@vue/language-server/node.ts',
		'plugin': './node_modules/@vue/typescript-plugin/index.ts',
	},
	output: {
		format: 'cjs',
		sourcemap: !process.argv.includes('--minify'),
	},
	define: {
		'process.env.NODE_ENV': process.argv.includes('--minify') ? '"production"' : '"development"',
	},
	external: ['vscode'],
	plugins: [
		{
			name: 'umd2esm',
			resolveId: {
				filter: {
					id: /^(vscode-.*-languageservice|vscode-languageserver-types|jsonc-parser)$/,
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
				fs.rmSync(resolve('./dist'), { recursive: true, force: true });
			},
		},
		{
			name: 'schemas',
			buildEnd() {
				fs.cpSync(
					resolve('./node_modules/@vue/language-core/schemas/vue-tsconfig.schema.json'),
					resolve('./dist/schemas/vue-tsconfig.schema.json'),
					{ recursive: true }
				);
			},
		},
		{
			name: 'typescript-plugin',
			buildEnd() {
				const dir = './node_modules/vue-typescript-plugin-pack';
				fs.mkdirSync(resolve(dir), { recursive: true });
				fs.writeFileSync(resolve(dir, 'index.js'), `module.exports = require('../../dist/plugin.js');`);
			},
		},
	],
});
