import * as path from 'node:path';
import * as ts from 'typescript';
import { expect, test } from 'vitest';
import { createProjectResolver, resolveModuleName } from '../lib/project';

const testWorkspacePath = path.resolve(__dirname, '../../../test-workspace');
const firstProjectFile = path.join(testWorkspacePath, 'tsconfigProject/fixture.vue');
const secondProjectFile = path.join(testWorkspacePath, 'tsconfigProject2/fixture.vue');

test('resolves the tsconfig that owns a file', () => {
	const resolver = createProjectResolver(ts);

	expect(normalize(resolver.getConfigFileName(firstProjectFile)!)).toMatch(/tsconfigProject\/tsconfig\.json$/);
	expect(normalize(resolver.getConfigFileName(secondProjectFile)!)).toMatch(/tsconfigProject2\/tsconfig\.json$/);
	// no tsconfig includes this file, and the solution-style root tsconfig only holds references
	expect(resolver.getConfigFileName(path.join(testWorkspacePath, 'not-a-project/file.vue'))).toBeUndefined();

	resolver.dispose();
});

test('resolves module names with the owning project options', () => {
	const resolver = createProjectResolver(ts);
	const firstOptions = resolver.getCommandLine(firstProjectFile)!.options;
	const secondOptions = resolver.getCommandLine(secondProjectFile)!.options;

	// `@/*` only exists in tsconfigProject, `@2/*` only in tsconfigProject2
	expect(normalize(resolveModuleName(ts, firstOptions, firstProjectFile, '@/fixture')!)).toMatch(
		/tsconfigProject\/fixture\.ts$/,
	);
	expect(resolveModuleName(ts, firstOptions, firstProjectFile, '@2/fixture')).toBeUndefined();
	expect(normalize(resolveModuleName(ts, secondOptions, secondProjectFile, '@2/fixture')!)).toMatch(
		/tsconfigProject2\/fixture\.ts$/,
	);

	resolver.dispose();
});

function normalize(fileName: string) {
	return fileName.replace(/\\/g, '/');
}
