import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig, type RolldownOptions } from 'rolldown';

const isDev = !process.argv.includes('--minify');
const resolve = (...paths: string[]) => path.resolve(__dirname, ...paths);

const config: RolldownOptions = {
	input: {
		'client': './src/nodeClientMain.ts',
	},
	output: {
		format: 'cjs',
		sourcemap: isDev,
	},
	define: {
		'process.env.NODE_ENV': '"production"',
	},
	external: ['vscode'],
	plugins: [
		{
			name: 'clean',
			buildStart() {
				fs.rmSync(resolve('./dist'), { recursive: true, force: true });
			},
		},
		{
			name: 'redirect',
			buildEnd() {
				fs.mkdirSync(resolve('./node_modules/vue-typescript-plugin-pack'), { recursive: true });
				fs.writeFileSync(resolve('./node_modules/vue-typescript-plugin-pack/index.js'), `module.exports = require('../../dist/typescript-plugin.js');`);

				if (isDev) {
					fs.mkdirSync(resolve('./dist'), { recursive: true });
					fs.writeFileSync(resolve('./dist/language-server.js'), `module.exports = require('../node_modules/@vue/language-server/index.js');`);
					fs.writeFileSync(resolve('./dist/typescript-plugin.js'), `module.exports = require('../node_modules/@vue/typescript-plugin/index.js');`);
				}
			},
		},
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
			name: 'typescript',
			resolveId: {
				filter: {
					id: /^typescript$/,
				},
				handler() {
					return { id: './typescript.js', external: true };
				},
			},
		},
	],
};

if (!isDev) {
	config.input = {
		...config.input as Record<string, string>,
		'language-server': './node_modules/@vue/language-server/index.js',
		'typescript-plugin': './node_modules/@vue/typescript-plugin/index.js',
	};
}

export default defineConfig(config);
