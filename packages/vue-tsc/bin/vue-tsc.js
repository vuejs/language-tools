#!/usr/bin/env node
const fs = require('fs');

const readFileSync = fs.readFileSync;
const tscPath = require.resolve('typescript/lib/tsc');
const proxyPath = require.resolve('../out/proxy');

fs.readFileSync = (...args) => {
    if (args[0] === tscPath) {
        let tsc = readFileSync(...args);

        // add *.vue files to allow extensions
        tsc = tsc.replace(
            `ts.supportedTSExtensions = [[".ts", ".tsx", ".d.ts"], [".cts", ".d.cts"], [".mts", ".d.mts"]];`,
            // `ts.supportedTSExtensions = [[".ts", ".tsx", ".d.ts"], [".cts", ".d.cts"], [".mts", ".d.mts"], [".vue", ".md", ".html"]];`,
            `ts.supportedTSExtensions = [[".ts", ".tsx", ".d.ts"], [".cts", ".d.cts"], [".mts", ".d.mts"], [".vue"]];`,
        );
        tsc = tsc.replace(
            `ts.supportedJSExtensions = [[".js", ".jsx"], [".mjs"], [".cjs"]];`,
            // `ts.supportedJSExtensions = [[".js", ".jsx"], [".mjs"], [".cjs"], [".vue", ".md", ".html"]];`,
            `ts.supportedJSExtensions = [[".js", ".jsx"], [".mjs"], [".cjs"], [".vue"]];`,
        );
        tsc = tsc.replace(
            `var allSupportedExtensions = [[".ts", ".tsx", ".d.ts", ".js", ".jsx"], [".cts", ".d.cts", ".cjs"], [".mts", ".d.mts", ".mjs"]];`,
            // `var allSupportedExtensions = [[".ts", ".tsx", ".d.ts", ".js", ".jsx"], [".cts", ".d.cts", ".cjs"], [".mts", ".d.mts", ".mjs"], [".vue", ".md", ".html"]];`,
            `var allSupportedExtensions = [[".ts", ".tsx", ".d.ts", ".js", ".jsx"], [".cts", ".d.cts", ".cjs"], [".mts", ".d.mts", ".mjs"], [".vue"]];`,
        );

        // proxy createProgram apis
        tsc = tsc.replace(
            `function createProgram(rootNamesOrOptions, _options, _host, _oldProgram, _configFileParsingDiagnostics) {`,
            `function createProgram(rootNamesOrOptions, _options, _host, _oldProgram, _configFileParsingDiagnostics) { return require(${JSON.stringify(proxyPath)}).createProgramProxy(...arguments);`,
        );

        // proxy tracing
        tsc = tsc.replace(
            `ts.startTracing = tracingEnabled.startTracing;`,
            `ts.startTracing = require(${JSON.stringify(proxyPath)}).loadTsLib().startTracing;`,
        );

        tsc = tsc.replace(
            `ts.dumpTracingLegend = tracingEnabled.dumpLegend;`,
            `ts.dumpTracingLegend = require(${JSON.stringify(proxyPath)}).loadTsLib().dumpTracingLegend;`,
        );

        return tsc;
    }
    return readFileSync(...args);
};

require(tscPath);
