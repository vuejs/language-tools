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
	const project = await resolver.getProject(fileName('tsconfigSolution/src/App.vue'));
	expect(project!.parsedCommandLine.options.paths).toEqual({ '@solution/*': ['../src/*'] });
});

test('an own contentMappers array replaces the inherited one', async () => {
	await expectConfigFileName('tsconfigContentMappers/fixture.md', 'tsconfigContentMappers/tsconfig.json');
	// the override config only maps `.vue`, so the TypeScript language server hands its `.md` file to the parent config
	await expectConfigFileName('tsconfigContentMappers/override/fixture.md', 'tsconfigContentMappers/tsconfig.json');
});

test('options are merged across extends, raw only carries the resolved contentMappers', async () => {
	const { parsedCommandLine } = (await resolver.getProject(fileName('tsconfigContentMappers/fixture.md')))!;
	expect(parsedCommandLine.options.strict).toBe(true);
	expect(parsedCommandLine.raw?.contentMappers).toEqual([
		{ package: '@vue/content-mapper', extensions: ['.vue'] },
		{ package: '@vue/content-mapper', extensions: ['.md'], options: { format: 'vitepress' } },
	]);
	// the language server reads `vueCompilerOptions` locally because of this
	expect(parsedCommandLine.raw).not.toHaveProperty('vueCompilerOptions');
});

test('an inferred project has compiler options but no config file', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-inferred-'));
	try {
		const file = path.join(dir, 'a.ts');
		fs.writeFileSync(file, 'export {};');
		const project = await resolver.getProject(file.replace(/\\/g, '/'));
		expect(project).toBeDefined();
		expect(project!.configFileName).toBeUndefined();
		expect(project!.parsedCommandLine.options).toMatchObject({ allowJs: true });
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
		const writeConfig = (strict: boolean) =>
			fs.writeFileSync(tsconfig, JSON.stringify({ compilerOptions: { strict }, include: ['*.ts'] }));
		writeConfig(false);
		fs.writeFileSync(file, 'export {};');
		expect((await resolver.getProject(file.replace(/\\/g, '/')))!.parsedCommandLine.options.strict).toBe(false);

		writeConfig(true);
		// the TypeScript language server does not watch files itself and the API cannot tell it about changes
		resolver.invalidate();
		expect((await resolver.getProject(file.replace(/\\/g, '/')))!.parsedCommandLine.options.strict).toBe(false);

		server.notify('workspace/didChangeWatchedFiles', { changes: [{ uri: pathToFileURL(tsconfig).href, type: 2 }] });
		// a round trip on the same connection guarantees the notification was read before the API is asked
		await server.request('vue/sync', {}).catch(() => {});
		resolver.invalidate();
		expect((await resolver.getProject(file.replace(/\\/g, '/')))!.parsedCommandLine.options.strict).toBe(true);
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
