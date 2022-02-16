require('esbuild').build({
    entryPoints: {
        client: './node_modules/@volar/client/out/browserClientMain.js',
        // server: './node_modules/@volar/server/out/browser.js',
    },
    bundle: true,
    outdir: './out/browser',
    external: ['vscode'],
    format: 'cjs',
    platform: 'browser',
    tsconfig: '../../tsconfig.build.json',
    minify: process.argv.includes('--minify'),
    watch: process.argv.includes('--watch'),
}).catch(() => process.exit(1))
