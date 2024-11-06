import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { defineConfig } from 'tsup';

const require = createRequire(import.meta.url);

export default defineConfig([
	{
		entry: {
			'dist/client': './out/nodeClientMain.js',
			'dist/server':
				'./node_modules/@vue/language-server/bin/vue-language-server.js',
			'./node_modules/typescript-vue-plugin-bundle/index.js': './node_modules/@vue/typescript-plugin/index.js'
		},
		bundle: true,
		metafile: process.argv.includes('--metafile'),
		outDir: '.',
		external: ['vscode'],
		format: 'cjs',
		platform: 'node',
		define: { 'process.env.NODE_ENV': '"production"' },
		minify: process.argv.includes('--minify'),
		esbuildPlugins: [
			{
				name: 'umd2esm',
				setup(build) {
					build.onResolve({ filter: /^(vscode-.*-languageservice|jsonc-parser)/ }, args => {
						const pathUmdMay = require.resolve(args.path, { paths: [args.resolveDir] });
						// Call twice the replace is to solve the problem of the path in Windows
						const pathEsm = pathUmdMay.replace('\\', '/').replace('/umd/', '/esm/');
						return { path: pathEsm };
					});
				},
			},
			require('esbuild-plugin-copy').copy({
				resolveFrom: 'cwd',
				assets: {
					from: ['./node_modules/@vue/language-core/schemas/**/*'],
					to: ['./dist/schemas'],
				},
				keepStructure: true,
			}),
			{
				name: 'meta',
				setup(build) {
					build.onEnd((result) => {
						if (result.metafile && result.errors.length === 0) {
							fs.writeFileSync(
								path.resolve(__dirname, './meta.json'),
								JSON.stringify(result.metafile),
							);
						}
					});
				},
			},
		],
	},
]);
