require('esbuild').build({
    entryPoints: ['./node_modules/typescript-vue-plugin/out/index.js'],
    bundle: true,
    outfile: './out/index.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    tsconfig: '../../tsconfig.build.json',
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
            build.onResolve({ filter: /\@vue\/compiler-sfc/ }, args => {
                const pathUmdMay = require.resolve(args.path, { paths: [args.resolveDir] })
                const pathEsm = pathUmdMay.replace('compiler-sfc.cjs.js', 'compiler-sfc.esm-browser.js')
                return { path: pathEsm }
            })
        },
    }],
}).catch(() => process.exit(1))
