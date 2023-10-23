require('esbuild').build({
	entryPoints: ['./node_modules/typescript-vue-plugin/out/index.js'],
	bundle: true,
	outfile: './node_modules/typescript-vue-plugin-bundle/index.js',
	external: [
		'vscode',
		'typescript', // vue-component-meta
	],
	format: 'cjs',
	platform: 'node',
	tsconfig: './tsconfig.json',
	minify: process.argv.includes('--minify'),
	watch: process.argv.includes('--watch'),
	plugins: [{
		name: 'umd2esm',
		setup(build) {
			build.onResolve({ filter: /^(vscode-.*-languageservice|jsonc-parser)/ }, args => {
				const pathUmdMay = require.resolve(args.path, { paths: [args.resolveDir] })
				const pathEsm = pathUmdMay.replace('/umd/', '/esm/')
				return { path: pathEsm }
			})
		},
	}],
}).catch(() => process.exit(1))
