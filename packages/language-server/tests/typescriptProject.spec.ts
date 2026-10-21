import * as path from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { type LspServer, startLspServer } from '../../content-mapper/tests/lsp';
import { connectTypeScriptProjectResolver, type TypeScriptProjectResolver } from '../lib/typescriptProject';
import { testWorkspacePath, typescriptPackageJsonPath } from './server';

let server: LspServer;
let resolver: TypeScriptProjectResolver;

beforeAll(async () => {
	server = await startLspServer(testWorkspacePath);
	const { pipe } = await server.request<{ pipe: string }>('custom/initializeAPISession', {});
	resolver = await connectTypeScriptProjectResolver(pipe, typescriptPackageJsonPath);
});

afterAll(() => {
	resolver?.dispose();
	server?.close();
});

/** A workspace file name in the form the language server passes. */
function fileName(file: string) {
	return path.join(testWorkspacePath, file).replace(/\\/g, '/');
}

async function expectConfigFileName(file: string, expected: string) {
	const configFileName = (await resolver.getProject(fileName(file)))?.configFileName;
	expect(configFileName).toBeDefined();
	expect(path.relative(configFileName!, path.join(testWorkspacePath, expected))).toBe('');
}

test('a file imported from outside include belongs to the importing project', async () => {
	await expectConfigFileName('typescriptProject/imported/shared/b.ts', 'typescriptProject/imported/tsconfig.json');
});

test('a jsconfig owns its files', async () => {
	await expectConfigFileName('typescriptProject/jsconfig/a.js', 'typescriptProject/jsconfig/jsconfig.json');
});

test('a content-mapped .vue file belongs to the tsconfig that declares the mapper', async () => {
	await expectConfigFileName('content-mapper-lsp/Model.vue', 'content-mapper-lsp/tsconfig.json');
});

test('a solution-style tsconfig hands the file to the referenced project', async () => {
	await expectConfigFileName('tsconfigSolution/src/App.vue', 'tsconfigSolution/generated/tsconfig.app.json');
	const project = await resolver.getProject(fileName('tsconfigSolution/src/App.vue'));
	expect(project!.parsedCommandLine.options.paths).toEqual({ '@solution/*': ['../src/*'] });
});

test('an own contentMappers array replaces the inherited one', async () => {
	await expectConfigFileName('tsconfigContentMappers/fixture.md', 'tsconfigContentMappers/tsconfig.json');
	// the override config only maps `.vue`, so the TypeScript language server hands its `.md` file to the parent config
	await expectConfigFileName('tsconfigContentMappers/override/fixture.md', 'tsconfigContentMappers/tsconfig.json');
});

test('a .vue file no content mapper covers has no project', async () => {
	expect(await resolver.getProject(fileName('fixture.vue'))).toBeUndefined();
});

test('a closed file resolves again when asked later', async () => {
	resolver.closeFile(fileName('typescriptProject/jsconfig/a.js'));
	await expectConfigFileName('typescriptProject/jsconfig/a.js', 'typescriptProject/jsconfig/jsconfig.json');
});
