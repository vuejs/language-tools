#!/usr/bin/env node
const fs = require('fs');

const readFileSync = fs.readFileSync;
const tscPath = require.resolve('typescript/lib/tsc');
const proxyPath = require.resolve('../out/proxy');

fs.readFileSync = (...args) => {
	if (args[0] === tscPath) {
		let tsc = readFileSync(...args);

		// add *.vue files to allow extensions
		tryReplace(/supportedTSExtensions = .*(?=;)/, s => s + '.concat([[".vue"]])');
		tryReplace(/supportedJSExtensions = .*(?=;)/, s => s + '.concat([[".vue"]])');
		tryReplace(/allSupportedExtensions = .*(?=;)/, s => s + '.concat([[".vue"]])');

		// proxy startTracing, dumpTracingLegend
		tryReplace(/ = tracingEnabled\./g, ` = require(${JSON.stringify(proxyPath)}).loadTsLib().`);

		// proxy createProgram apis
		tryReplace(/function createProgram\(.+\) {/, s => s + ` return require(${JSON.stringify(proxyPath)}).createProgramProxy(...arguments);`);

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

require(tscPath);
