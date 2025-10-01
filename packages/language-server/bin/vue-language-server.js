#!/usr/bin/env node

if (process.argv.includes('--version')) {
	console.log(require('../package.json').version);
	return;
}

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

require('../lib/server').startServer(ts);
