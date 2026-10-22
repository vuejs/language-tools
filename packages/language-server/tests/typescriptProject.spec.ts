import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
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
});

test('an own contentMappers array replaces the inherited one', async () => {
	await expectConfigFileName('tsconfigContentMappers/fixture.vue.md', 'tsconfigContentMappers/tsconfig.json');
	// the override config only maps `.vue`, so the TypeScript language server hands its `.vue.md` file to the parent config
	await expectConfigFileName('tsconfigContentMappers/override/fixture.vue.md', 'tsconfigContentMappers/tsconfig.json');
});

test('a project carries the contentMappers inherited through extends', async () => {
	const project = await resolver.getProject(fileName('tsconfigContentMappers/fixture.vue.md'));
	expect(project?.contentMappers).toEqual([
		{ package: '@vue/content-mapper', extensions: ['.vue'] },
		{ package: '@vue/content-mapper', extensions: ['.vue.md'], options: { format: 'vitepress' } },
	]);
});

test('an inferred project has no config file and no content mappers', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-inferred-'));
	try {
		const file = path.join(dir, 'a.ts');
		fs.writeFileSync(file, 'export {};');
		const project = await resolver.getProject(file.replace(/\\/g, '/'));
		expect(project).toEqual({ configFileName: undefined, contentMappers: undefined });
	}
	finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test('after invalidate, a config change the TypeScript language server was told about shows up', async () => {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vue-config-change-')));
	try {
		const tsconfig = path.join(dir, 'tsconfig.json');
		const file = path.join(dir, 'a.ts');
		const writeConfig = (extension: string) =>
			fs.writeFileSync(
				tsconfig,
				JSON.stringify({ include: ['*.ts'], contentMappers: [{ package: 'example-mapper', extensions: [extension] }] }),
			);
		const getExtensions = async () =>
			((await resolver.getProject(file.replace(/\\/g, '/')))?.contentMappers as { extensions: string[] }[])
				.map(entry => entry.extensions);
		writeConfig('.a');
		fs.writeFileSync(file, 'export {};');
		expect(await getExtensions()).toEqual([['.a']]);

		writeConfig('.b');
		// the TypeScript language server does not watch files itself and the API cannot tell it about changes
		resolver.invalidate();
		expect(await getExtensions()).toEqual([['.a']]);

		server.notify('workspace/didChangeWatchedFiles', { changes: [{ uri: pathToFileURL(tsconfig).href, type: 2 }] });
		// a round trip on the same connection guarantees the notification was read before the API is asked
		await server.request('vue/sync', {}).catch(() => {});
		resolver.invalidate();
		expect(await getExtensions()).toEqual([['.b']]);
	}
	finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test('a .vue file no content mapper covers has no project', async () => {
	expect(await resolver.getProject(fileName('fixture.vue'))).toBeUndefined();
});

test('a closed file resolves again when asked later', async () => {
	resolver.closeFile(fileName('typescriptProject/jsconfig/a.js'));
	await expectConfigFileName('typescriptProject/jsconfig/a.js', 'typescriptProject/jsconfig/jsconfig.json');
});
