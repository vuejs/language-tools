require('esbuild').build({
    entryPoints: {
        client: './out/browserClientMain.js',
        // server: './node_modules/@volar/vue-language-server/out/browser.js', // TODO: fix node depends
    },
    bundle: true,
    outdir: './dist/browser',
    external: ['vscode'],
    format: 'cjs',
    platform: 'browser',
    tsconfig: '../../tsconfig.build.json',
    minify: process.argv.includes('--minify'),
    watch: process.argv.includes('--watch'),
}).catch(() => process.exit(1))
