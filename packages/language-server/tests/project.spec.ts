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

test('follows project references of a solution-style tsconfig', () => {
	const resolver = createProjectResolver(ts);
	// Nuxt 3 shape: the root tsconfig only holds references, the generated config owns the files.
	const appFile = path.join(testWorkspacePath, 'tsconfigSolution/src/App.vue');

	expect(normalize(resolver.getConfigFileName(appFile)!)).toMatch(/tsconfigSolution\/generated\/tsconfig\.app\.json$/);
	expect(resolver.getCommandLine(appFile)!.options.paths).toEqual({ '@solution/*': ['../src/*'] });

	resolver.dispose();
});

test('reads contentMappers through extends and routes ownership by their extensions', () => {
	const resolver = createProjectResolver(ts);
	const configFileName = resolver.getConfigFileName(path.join(testWorkspacePath, 'tsconfigContentMappers/fixture.md'))!;

	expect(normalize(configFileName)).toMatch(/tsconfigContentMappers\/tsconfig\.json$/);
	expect(resolver.getContentMappers(configFileName)).toEqual([
		{ package: '@vue/content-mapper', extensions: ['.vue'] },
		{ package: '@vue/content-mapper', extensions: ['.md'], options: { format: 'vitepress' } },
	]);

	// an own `contentMappers` replaces the inherited array, so `.md` is no longer owned
	const overrideConfigFileName = path.join(testWorkspacePath, 'tsconfigContentMappers/override/tsconfig.json');
	expect(resolver.getContentMappers(overrideConfigFileName)).toEqual([
		{ package: '@vue/content-mapper', extensions: ['.vue'] },
	]);
	expect(
		normalize(resolver.getConfigFileName(path.join(testWorkspacePath, 'tsconfigContentMappers/override/fixture.md'))!),
	)
		.toMatch(/tsconfigContentMappers\/tsconfig\.json$/);

	expect(resolver.getContentMappers(path.join(testWorkspacePath, 'tsconfigProject/tsconfig.json'))).toBeUndefined();

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
