#!/usr/bin/env node
const semver = require('semver')
const fs = require('fs');
const ts = require('typescript/lib/typescript');
const readFileSync = fs.readFileSync;
const tscPath = require.resolve('typescript/lib/tsc');
const proxyApiPath = require.resolve('../out/index');
const buildInfoRootsPath = require.resolve('../out/buildInfoRoots')
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

		// patches logic for checking root file existance in build program for incremental builds
		optionalReplace({ max: '5.0.0' }, /for \(const existingRoot of buildInfoVersionMap.roots\) {/,  `for (const existingRoot of require(${JSON.stringify(buildInfoRootsPath)}).patchBuildInfoRoots(buildInfoVersionMap.roots)) {`);

		return tsc;

		function tryReplace(search, replace) {
			const before = tsc;
			tsc = tsc.replace(search, replace);
			const after = tsc;
			if (after === before) {
				throw 'Search string not found: ' + JSON.stringify(search.toString());
			}
		}

		function optionalReplace(range, search, replace) {
			if (range.min && semver.lt(ts.version, range.min)) return
			if (range.max && semver.gt(ts.version, range.max)) return
			tryReplace(search, replace)
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
