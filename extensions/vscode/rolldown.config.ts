import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig } from 'rolldown';

const volarDir = path.resolve(__dirname, '../../volar.js') + path.sep;

export default defineConfig({
	input: {
		'extension': './src/extension.ts',
		'language-server': './node_modules/@vue/language-server/index.ts',
		'content-mapper-server': '../../packages/content-mapper/server.ts',
		'content-mapper-worker': '../../packages/content-mapper/worker.ts',
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
			name: 'copy-types',
			buildEnd() {
				const sourceDir = path.resolve(__dirname, '../../packages/language-core/types');
				const targetDir = path.resolve(__dirname, './types');
				fs.rmSync(targetDir, { recursive: true, force: true });
				fs.cpSync(sourceDir, targetDir, { recursive: true });
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
			// The volar.js submodule keeps its sources next to the output, and its
			// sources are not isolatedModules-safe: bundle the JS that `npm run build:volar` emits.
			name: 'volar.js',
			resolveId(source, importer) {
				if (!importer) {
					return;
				}
				const fromVolar = path.normalize(importer).startsWith(volarDir);
				if (source.startsWith('@volar/') || (fromVolar && source.startsWith('.'))) {
					return { id: require.resolve(source, { paths: [path.dirname(importer)] }) };
				}
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
