#!/usr/bin/env node
const fs = require('fs');
const readFileSync = fs.readFileSync;
const tscPath = require.resolve('typescript/lib/tsc');
const proxyApiPath = require.resolve('../out/index');
const { state } = require('../out/shared');

fs.readFileSync = (...args) => {
	if (args[0] === tscPath) {
		let tsc = readFileSync(...args);

		// add *.vue files to allow extensions
		tryReplace(/supportedTSExtensions = .*(?=;)/, s => s + '.concat([[".vue"]])');
		tryReplace(/supportedJSExtensions = .*(?=;)/, s => s + '.concat([[".vue"]])');
		tryReplace(/allSupportedExtensions = .*(?=;)/, s => s + '.concat([[".vue"]])');

		// proxy createProgram apis
		tryReplace(/function createProgram\(.+\) {/, s => s + ` return require(${JSON.stringify(proxyApiPath)}).createProgram(...arguments);`);

		return tsc;

		function tryReplace(search, replace) {
			const before = tsc;
			tsc = tsc.replace(search, replace);
			const after = tsc;
			if (after === before) {
				throw 'Search string not found: ' + JSON.stringify(search.toString());
			}
		}
	}
	return readFileSync(...args);
};

(function main() {
	try {
		require(tscPath);
	}
	catch (err) {
		if (err === 'hook') {
			state.hook.worker.then(main);
		}
		else {
			throw err;
		}
	}
})();
