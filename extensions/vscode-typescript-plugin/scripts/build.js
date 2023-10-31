// @ts-check

require('esbuild').context({
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
}).then(async ctx => {
	console.log('building...');
	if (process.argv.includes('--watch')) {
		await ctx.watch();
		console.log('watching...');
	} else {
		await ctx.rebuild();
		await ctx.dispose();
		console.log('finished.');
	}
})
