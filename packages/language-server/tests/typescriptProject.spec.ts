import * as path from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { type LspServer, startLspServer } from '../../content-mapper/tests/lsp';
import { connectTypeScriptProjectResolver, type TypeScriptProjectResolver } from '../lib/typescriptProject';

const repositoryRoot = path.resolve(__dirname, '../../..');
const testWorkspacePath = path.join(repositoryRoot, 'test-workspace');

let server: LspServer;
let resolver: TypeScriptProjectResolver;

beforeAll(async () => {
	server = await startLspServer(testWorkspacePath);
	const { pipe } = await server.request<{ pipe: string }>('custom/initializeAPISession', {});
	resolver = await connectTypeScriptProjectResolver(
		pipe,
		path.join(repositoryRoot, 'node_modules/typescript-7/package.json'),
	);
});

afterAll(() => {
	resolver?.dispose();
	server?.close();
});

/** The tsconfig the TypeScript language server picks for a workspace file, given and returned the way the language server uses them. */
function getConfigFileName(file: string) {
	return resolver.getConfigFileName(path.join(testWorkspacePath, file).replace(/\\/g, '/'));
}

function expectSamePath(actual: string | undefined, expected: string) {
	expect(actual).toBeDefined();
	expect(path.relative(actual!, path.join(testWorkspacePath, expected))).toBe('');
}

test('a file imported from outside include belongs to the importing project', async () => {
	expectSamePath(
		await getConfigFileName('typescriptProject/imported/shared/b.ts'),
		'typescriptProject/imported/tsconfig.json',
	);
});

test('a jsconfig owns its files', async () => {
	expectSamePath(
		await getConfigFileName('typescriptProject/jsconfig/a.js'),
		'typescriptProject/jsconfig/jsconfig.json',
	);
});

test('a content-mapped .vue file belongs to the tsconfig that declares the mapper', async () => {
	expectSamePath(await getConfigFileName('content-mapper-lsp/Model.vue'), 'content-mapper-lsp/tsconfig.json');
});

test('a closed file resolves again when asked later', async () => {
	const fileName = path.join(testWorkspacePath, 'typescriptProject/jsconfig/a.js').replace(/\\/g, '/');
	resolver.closeFile(fileName);
	expectSamePath(await resolver.getConfigFileName(fileName), 'typescriptProject/jsconfig/jsconfig.json');
});
