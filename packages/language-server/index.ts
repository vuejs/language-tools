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
	startServer(ts);
}
