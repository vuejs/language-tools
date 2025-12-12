import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig } from 'rolldown';

export default defineConfig({
	input: {
		'extension': './src/extension.js',
		'reactivity-analysis-plugin': './src/reactivityAnalysisPlugin.js',
		'language-server': '../../packages/language-server/index.ts',
		'typescript-plugin': '../../packages/typescript-plugin/index.ts',
	},
	output: {
		format: 'cjs',
		minify: true,
	},
	transform: {
		define: {
			'process.env.NODE_ENV': '"production"',
		},
	},
	checks: {
		eval: false,
	},
	external: ['vscode'],
	plugins: [
		{
			name: 'clean',
			buildStart() {
				fs.rmSync(path.resolve(__dirname, './dist'), { recursive: true, force: true });
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
					return { id: 'typescript', external: true };
				},
			},
		},
	],
});
