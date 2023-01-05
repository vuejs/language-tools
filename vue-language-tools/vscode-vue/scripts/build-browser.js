require('esbuild').build({
	entryPoints: process.argv.includes('--empty') ? {
		client: './scripts/empty.js',
	} : {
		client: './out/browserClientMain.js',
	},
	bundle: true,
	outdir: './dist/browser',
	external: ['vscode'],
	format: 'cjs',
	tsconfig: '../../tsconfig.build.json',
	minify: process.argv.includes('--minify'),
	watch: process.argv.includes('--watch'),
	plugins: [
		{
			name: 'node-deps',
			setup(build) {
				build.onResolve({ filter: /^\@vue\/.*$/ }, args => {
					const pathUmdMay = require.resolve(args.path, { paths: [args.resolveDir] })
					const pathEsm = pathUmdMay.replace('.cjs.', '.esm-browser.')
					return { path: pathEsm }
				})
				build.onResolve({ filter: /^path$/ }, args => {
					const path = require.resolve('../node_modules/path-browserify', { paths: [__dirname] })
					return { path: path }
				})
			},
		},
		require('esbuild-plugin-copy').copy({
			resolveFrom: 'cwd',
			assets: {
				from: ['./node_modules/@volar/vue-language-core/schemas/**/*'],
				to: ['./dist/schemas'],
			},
			keepStructure: true,
		}),
	],
}).catch(() => process.exit(1))

require('esbuild').build({
	entryPoints: process.argv.includes('--empty') ? {
		server: './scripts/empty.js',
	} : {
		server: './node_modules/@volar/vue-language-server/out/webServer.js',
	},
	bundle: true,
	outdir: './dist/browser',
	external: ['fs'],
	format: 'iife',
	tsconfig: '../../tsconfig.build.json',
	inject: ['./scripts/process-shim.js'],
	minify: process.argv.includes('--minify'),
	watch: process.argv.includes('--watch'),
	plugins: [
		{
			name: 'node-deps',
			setup(build) {
				build.onResolve({ filter: /^vscode-.*-languageservice$/ }, args => {
					const pathUmdMay = require.resolve(args.path, { paths: [args.resolveDir] })
					const pathEsm = pathUmdMay.replace('/umd/', '/esm/')
					return { path: pathEsm }
				})
				build.onResolve({ filter: /^\@vue\/.*$/ }, args => {
					const pathUmdMay = require.resolve(args.path, { paths: [args.resolveDir] })
					const pathEsm = pathUmdMay.replace('.cjs.', '.esm-browser.')
					return { path: pathEsm }
				})
				build.onResolve({ filter: /^path$/ }, args => {
					const path = require.resolve('../node_modules/path-browserify', { paths: [__dirname] })
					return { path: path }
				})
				build.onResolve({ filter: /^punycode$/ }, args => {
					const path = require.resolve('../node_modules/punycode', { paths: [__dirname] })
					return { path: path }
				})
			},
		},
	],
}).catch(() => process.exit(1))
