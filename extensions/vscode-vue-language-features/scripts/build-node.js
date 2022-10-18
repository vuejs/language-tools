const path = require('path');
const fs = require('fs');

require('esbuild').build({
	entryPoints: process.argv.includes('--empty') ? {
		client: './scripts/empty.js',
		server: './scripts/empty.js',
	} : {
		client: './out/nodeClientMain.js',
		server: './node_modules/@volar/vue-language-server/out/nodeServer.js',
	},
	bundle: true,
	metafile: process.argv.includes('--metafile'),
	outdir: './dist/node',
	external: [
		'vscode',
		'typescript', // vue-component-meta
	],
	format: 'cjs',
	platform: 'node',
	tsconfig: '../../tsconfig.build.json',
	define: { 'process.env.NODE_ENV': '"production"' },
	minify: process.argv.includes('--minify'),
	watch: process.argv.includes('--watch'),
	plugins: [
		{
			name: 'umd2esm',
			setup(build) {
				build.onResolve({ filter: /^(vscode-.*|estree-walker|jsonc-parser)/ }, args => {
					const pathUmdMay = require.resolve(args.path, { paths: [args.resolveDir] })
					// Call twice the replace is to solve the problem of the path in Windows
					const pathEsm = pathUmdMay.replace('/umd/', '/esm/').replace('\\umd\\', '\\esm\\')
					return { path: pathEsm }
				})
			},
		},
		require('esbuild-plugin-copy').copy({
			resolveFrom: 'cwd',
			assets: {
				from: ['./node_modules/@volar/preview/bin/**/*'],
				to: ['./dist/preview-bin'],
			},
			keepStructure: true,
		}),
		require('esbuild-plugin-copy').copy({
			resolveFrom: 'cwd',
			assets: {
				from: ['./node_modules/@volar/vue-language-core/schemas/**/*'],
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
							path.resolve(__dirname, '../meta.json'),
							JSON.stringify(result.metafile),
						);
					}
				});
			},
		},
	],
}).catch(() => process.exit(1))
