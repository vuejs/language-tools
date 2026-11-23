import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { registerModuleTransform, reloadModuleExports } from '../src/registerModuleTransform';

const tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vue-module-transform-')));

// how esbuild bundles a CommonJS entry: every export is a getter-only, non-configurable property
const esbuildModule = `
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
	for (var name in all) {
		__defProp(target, name, { get: all[name], enumerable: true });
	}
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === 'object' || typeof from === 'function') {
		for (let key of __getOwnPropNames(from)) {
			if (!__hasOwnProp.call(to, key) && key !== except) {
				__defProp(to, key, {
					get: () => from[key],
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
				});
			}
		}
	}
	return to;
};
var __toCommonJS = mod => __copyProps(__defProp({}, '__esModule', { value: true }), mod);

var extension_exports = {};
__export(extension_exports, { activate: () => activate });
module.exports = __toCommonJS(extension_exports);

function activate() {
	return 'ORIGINAL';
}
`;

// how the TypeScript extension was bundled before 1.110: ts-loader output, where the exports are
// writable data properties next to the non-writable `__esModule` marker of the CommonJS tsc emit
const webpackModule = `
Object.defineProperty(exports, '__esModule', { value: true });
exports.activate = function activate() {
	return 'ORIGINAL';
};
`;

afterAll(() => {
	fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('reloadModuleExports', () => {
	test('swaps writable exports in place', () => {
		const { fileName, exports } = loadModule('webpack.js', webpackModule);

		expect(Object.getOwnPropertyDescriptor(exports, '__esModule')).toMatchObject({
			writable: false,
			enumerable: false,
		});
		expect(reload(fileName)).toBe(true);
		expect(exports.activate()).toBe('PATCHED');
	});

	test('bails out on getter-only exports', () => {
		const { fileName, exports } = loadModule('esbuild.js', esbuildModule);

		expect(Object.getOwnPropertyDescriptor(exports, 'activate')).toMatchObject({
			get: expect.any(Function),
			set: undefined,
			configurable: false,
		});
		expect(reload(fileName)).toBe(false);
		expect(exports.activate()).toBe('ORIGINAL');
	});

	test('reports success for a module that is not loaded yet', () => {
		const fileName = path.join(tempDir, 'unloaded.js');
		fs.writeFileSync(fileName, webpackModule);

		expect(reload(fileName)).toBe(true);
	});
});

function loadModule(name: string, source: string) {
	const fileName = path.join(tempDir, name);
	fs.writeFileSync(fileName, source);
	const exports = require(fileName);
	expect(exports.activate()).toBe('ORIGINAL');
	return { fileName, exports };
}

function reload(fileName: string) {
	const deregister = registerModuleTransform(fileName, text => text.replace(`'ORIGINAL'`, `'PATCHED'`));
	try {
		return reloadModuleExports(fileName);
	}
	finally {
		deregister();
		delete require.cache[fileName];
	}
}
