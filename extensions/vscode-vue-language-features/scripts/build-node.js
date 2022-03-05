require('esbuild').build({
    entryPoints: {
        client: './node_modules/@volar/client/out/nodeClientMain.js',
        server: './node_modules/@volar/server/out/node.js',
    },
    bundle: true,
    outdir: './out/node',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    tsconfig: '../../tsconfig.build.json',
    define: { 'process.env.NODE_ENV': '"production"' },
    minify: process.argv.includes('--minify'),
    watch: process.argv.includes('--watch'),
    plugins: [{
        name: 'umd2esm',
        setup(build) {
            build.onResolve({ filter: /(vscode-.*|estree-walker|jsonc-parser)/ }, args => {
                const pathUmdMay = require.resolve(args.path, { paths: [args.resolveDir] })
                const pathEsm = pathUmdMay.replace('/umd/', '/esm/')
                return { path: pathEsm }
            })
        },
    }],
}).catch(() => process.exit(1))
