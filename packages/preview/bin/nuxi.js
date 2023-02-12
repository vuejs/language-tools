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
		const configExtraContent = readFileSync(path.resolve(__dirname, 'nuxi', 'configExtraContent.ts'), { encoding: 'utf8' });
		return readFileSync(...args) + configExtraContent;
	}
	return readFileSync(...args);
};

createNuxtPlugin();

import('file://' + nuxiBinPath);

function createNuxtPlugin() {

	if (!fs.existsSync(path.resolve(workspace, 'node_modules', '.volar'))) {
		fs.mkdirSync(path.resolve(workspace, 'node_modules', '.volar'));
	}

	const proxyConfigPath = path.resolve(workspace, 'node_modules', '.volar', 'nuxt.plugin.ts');
	const pluginContent = fs.readFileSync(path.resolve(__dirname, 'nuxi', 'plugin.ts'), { encoding: 'utf8' });

	fs.writeFileSync(proxyConfigPath, pluginContent);
}
