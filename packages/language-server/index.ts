import { startServer } from './lib/server';

if (process.argv.includes('--version')) {
	console.log(require('./package.json').version);
}
else {
	let ts;
	for (const arg of process.argv) {
		if (arg.startsWith('--tsdk=')) {
			const tsdk = arg.substring('--tsdk='.length);
			const tsPath = require.resolve('./typescript.js', { paths: [tsdk] });
			ts = require(tsPath);
			break;
		}
	}
	ts ??= require('typescript');
	// TypeScript 7's `typescript` package has no classic compiler API
	if (typeof ts.createLanguageService !== 'function') {
		console.error(
			`@vue/language-server needs the API of TypeScript 5 or 6, which the loaded \`typescript\` ${
				ts.version ? `(${ts.version}) ` : ''
			}does not provide. Start the server with --tsdk=<path to the lib directory of a typescript 5 or 6 package>.`,
		);
		process.exit(1);
	}
	startServer(ts);
}
