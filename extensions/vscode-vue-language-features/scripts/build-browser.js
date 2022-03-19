require('esbuild').build({
    entryPoints: {
        client: './out/browserClientMain.js',
    },
    bundle: true,
    outdir: './dist/browser',
    external: ['vscode'],
    format: 'cjs',
    tsconfig: '../../tsconfig.build.json',
    minify: process.argv.includes('--minify'),
    watch: process.argv.includes('--watch'),
    plugins: [{
        name: 'node-deps',
        setup(build) {
            // build.onResolve({ filter: /^(vscode-.*|estree-walker|jsonc-parser)/ }, args => {
            //     const pathUmdMay = require.resolve(args.path, { paths: [args.resolveDir] })
            //     const pathEsm = pathUmdMay.replace('/umd/', '/esm/')
            //     return { path: pathEsm }
            // })
            build.onResolve({ filter: /^\@vue\/.*$/ }, args => {
                const pathUmdMay = require.resolve(args.path, { paths: [args.resolveDir] })
                const pathEsm = pathUmdMay.replace('.cjs.', '.esm-browser.')
                return { path: pathEsm }
            })
            build.onResolve({ filter: /^path$/ }, args => {
                const path = require.resolve('../node_modules/path-browserify', { paths: [__dirname] })
                return { path: path }
            })
            build.onResolve({ filter: /\/tsVersion$/ }, args => {
                const path = require.resolve(args.path.replace('/tsVersion', '/tsVersionEmpty'), { paths: [args.resolveDir] })
                return { path: path }
            })
        },
    }],
}).catch(() => process.exit(1))

require('esbuild').build({
    entryPoints: {
        server: './node_modules/@volar/vue-language-server/out/browser.js',
    },
    bundle: true,
    outdir: './dist/browser',
    format: 'iife',
    tsconfig: '../../tsconfig.build.json',
    minify: process.argv.includes('--minify'),
    watch: process.argv.includes('--watch'),
    plugins: [{
        name: 'node-deps',
        setup(build) {
            // build.onResolve({ filter: /^(vscode-.*|estree-walker|jsonc-parser)/ }, args => {
            //     const pathUmdMay = require.resolve(args.path, { paths: [args.resolveDir] })
            //     const pathEsm = pathUmdMay.replace('/umd/', '/esm/')
            //     if (pathUmdMay !== pathEsm)
            //         console.log(pathUmdMay)
            //     return { path: pathEsm }
            // })
            build.onResolve({ filter: /^vscode-.*-languageservice$/ }, args => {
                const pathUmdMay = require.resolve(args.path, { paths: [args.resolveDir] })
                const pathEsm = pathUmdMay.replace('/umd/', '/esm/')
                console.log(pathUmdMay, pathEsm)
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
        },
    }],
}).catch(() => process.exit(1))
