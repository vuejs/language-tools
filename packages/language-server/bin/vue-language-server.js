#!/usr/bin/env node

if (process.argv.includes('--version')) {
	console.log(require('../package.json').version);
	return;
}

require('../index.js');
