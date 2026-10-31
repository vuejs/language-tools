import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { loadTypeScript, resolveTypeScriptModule } from '../typescript';

const packageJsonPath = require.resolve('typescript/package.json');

test('resolves the modules of the TS 7.1 installation that a package.json names', () => {
	const packageDir = path.dirname(fs.realpathSync(packageJsonPath));
	for (const subpath of ['ast', 'sync', 'async'] as const) {
		expect(resolveTypeScriptModule(packageJsonPath, subpath).startsWith(packageDir + path.sep)).toBe(true);
	}
});

test('parses with the TS 7.1 installation that a package.json names', () => {
	const ts = loadTypeScript(packageJsonPath);
	expect(loadTypeScript(packageJsonPath)).toBe(ts);
	const sourceFile = ts.createSourceFile('/a.ts', 'const a = 1;', ts.ScriptTarget.Latest);
	expect(sourceFile.statements.map(statement => ts.isVariableStatement(statement))).toEqual([true]);
});
