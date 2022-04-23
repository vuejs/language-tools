#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const readFileSync = fs.readFileSync;

const workspace = process.cwd();
const nuxiBinPath = require.resolve('nuxi/cli', { paths: [workspace] });
const jsConfigPath = path.resolve(workspace, 'nuxt.config.js');
const tsConfigPath = path.resolve(workspace, 'nuxt.config.ts');

fs.readFileSync = (...args) => {
    if (args[0] === jsConfigPath || args[0] === tsConfigPath) {
        let configExtraContent = readFileSync(path.resolve(__dirname, 'nuxi', 'configExtraContent.ts'), { encoding: 'utf8' });
        configExtraContent = configExtraContent.replace("'{PLUGIN_PATH}'", JSON.stringify(path.resolve(__dirname, 'nuxi', 'plugin.ts')));
        return readFileSync(...args) + configExtraContent;
    }
    return readFileSync(...args);
};

import('file://' + nuxiBinPath);
