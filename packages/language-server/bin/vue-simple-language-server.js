#!/usr/bin/env node
if (process.argv.includes('--version')) {
	console.log(require('../package.json').version);
}
else {
	require('../out/simpleServer.js');
}
