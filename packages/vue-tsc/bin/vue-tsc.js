#!/usr/bin/env node
const fs = require('fs');

const readFileSync = fs.readFileSync;
const tscPath = require.resolve('typescript/lib/tsc');

fs.readFileSync = (...args) => {
    if (args[0] === tscPath) {
        let tsc = readFileSync(...args);
        tsc = tsc.replace(
            `function createIncrementalProgram(_a) {`,
            `function createIncrementalProgram(_a) { console.error('incremental mode is not yet support'); throw 'incremental mode is not yet support';`,
        );
        tsc = tsc.replace(
            `function createWatchProgram(host) {`,
            `function createWatchProgram(host) { console.error('watch mode is not yet support'); throw 'watch mode is not yet support';`,
        );
        tsc = tsc.replace(
            `function createProgram(rootNamesOrOptions, _options, _host, _oldProgram, _configFileParsingDiagnostics) {`,
            `function createProgram(rootNamesOrOptions, _options, _host, _oldProgram, _configFileParsingDiagnostics) { return require('vue-tsc/out/proxy').createProgramProxy(...arguments);`,
        );
        return tsc;
    }
    return readFileSync(...args);
};

require(tscPath);
