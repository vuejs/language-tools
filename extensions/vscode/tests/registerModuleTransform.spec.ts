import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { Module } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { registerModuleTransform } from '../src/registerModuleTransform';

const compiledEntry = path.resolve(__dirname, '../out/registerModuleTransform.js');

describe('registerModuleTransform', () => {
	test('does not install a sync module load hook', () => {
		// Sync load hooks are chained into the ESM loader too, where VS Code's async loader for ESM
		// extensions reports CommonJS dependencies as `source: null`. Node then throws inside our
		// `nextLoad()` call on every version that predates nodejs/node#59929, so the transform has to
		// stay on `Module.prototype._compile`.
		const registerHooks = vi.spyOn(Module, 'registerHooks');
		const originalCompile = (Module.prototype as any)._compile;
		const dispose = registerModuleTransform(createModule('module.exports = 1'), source => source);
		try {
			expect(registerHooks).not.toHaveBeenCalled();
			expect((Module.prototype as any)._compile).not.toBe(originalCompile);
		}
		finally {
			dispose();
			registerHooks.mockRestore();
		}
		expect((Module.prototype as any)._compile).toBe(originalCompile);
	});

	test('transforms only the target module and restores it on dispose', () => {
		const target = createModule(`module.exports = 'A'`);
		const other = createModule(`module.exports = 'A'`);
		const dispose = registerModuleTransform(target, source => source.replace('A', 'X'));
		try {
			expect(require(target)).toBe('X');
			expect(require(other)).toBe('A');
		}
		finally {
			dispose();
		}
		delete require.cache[target];
		expect(require(target)).toBe('A');
	});

	test('keeps ESM modules importing CommonJS working next to an async loader', () => {
		const dir = createFixture();
		const result = spawnSync(process.execPath, ['scenario.mjs', compiledEntry], {
			cwd: dir,
			encoding: 'utf8',
		});
		expect(result.stderr).toBe('');
		expect(result.status).toBe(0);
		expect(result.stdout.trim()).toBe('OK esm->cjs 1 target TRANSFORMED');
	});
});

function createModule(source: string) {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'volar-transform-')));
	const fileName = path.join(dir, 'index.js');
	fs.writeFileSync(fileName, source);
	return fileName;
}

/**
 * Mirrors an ESM extension in the extension host: an async loader is registered for ESM entry
 * points, the transform is installed for an unrelated CommonJS file, and the extension imports a
 * CommonJS dependency.
 */
function createFixture() {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'volar-esm-')));
	fs.writeFileSync(
		path.join(dir, 'async-hooks.mjs'),
		`export async function resolve(specifier, context, next) { return next(specifier, context); }\n`
			+ `export async function load(url, context, next) { return next(url, context); }\n`,
	);
	fs.writeFileSync(path.join(dir, 'dependency.cjs'), `module.exports = 1\n`);
	fs.writeFileSync(path.join(dir, 'target.cjs'), `module.exports = 'ORIGINAL'\n`);
	fs.writeFileSync(
		path.join(dir, 'scenario.mjs'),
		`import { createRequire, register } from 'node:module';\n`
			+ `import { pathToFileURL } from 'node:url';\n`
			+ `const require = createRequire(import.meta.url);\n`
			+ `register('./async-hooks.mjs', pathToFileURL('./'));\n`
			+ `const { registerModuleTransform } = require(process.argv[2]);\n`
			+ `registerModuleTransform(require.resolve('./target.cjs'), s => s.replace('ORIGINAL', 'TRANSFORMED'));\n`
			+ `const dependency = await import('./dependency.cjs');\n`
			+ `console.log('OK esm->cjs', dependency.default, 'target', require('./target.cjs'));\n`,
	);
	return dir;
}
