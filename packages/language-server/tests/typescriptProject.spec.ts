import { getDefaultCompilerOptions } from '@vue/language-core';
import { createVueLanguagePlugin, type VueVirtualCode } from '@vue/language-service';
import { asCoreTypeScript } from '@vue/language-service/lib/utils';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as ts from 'typescript';
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

test('auto-import components are reused across edits to the requesting file until another file changes', async () => {
	const dir = fs.mkdtempSync(path.join(testWorkspacePath, 'auto-import-cache-'));
	try {
		const write = (file: string, text: string) => {
			const filePath = path.join(dir, file);
			// FileChangeType: 1 created, 2 changed
			const type = fs.existsSync(filePath) ? 2 : 1;
			fs.writeFileSync(filePath, text);
			server.notify('workspace/didChangeWatchedFiles', { changes: [{ uri: pathToFileURL(filePath).href, type }] });
		};
		const writeComponent = (file: string, name: string) =>
			write(file, `import { defineComponent } from 'vue';\nexport const ${name} = defineComponent({});\n`);
		const toFileName = (file: string) => path.join(dir, file).replace(/\\/g, '/');
		const getNames = async () =>
			(await resolver.getAutoImportComponents(toFileName('a.ts')))?.map(component => component.name);
		write('tsconfig.json', JSON.stringify({ include: ['*.ts'] }));
		write('a.ts', 'export {};\n');
		writeComponent('foo.ts', 'Foo');
		const components = await resolver.getAutoImportComponents(toFileName('a.ts'));
		expect(components?.map(component => component.name)).toEqual(['Foo']);

		writeComponent('bar.ts', 'Bar');
		// a round trip on the same connection guarantees the notifications were read before the API is asked
		await server.request('vue/sync', {}).catch(() => {});
		resolver.fileChanged(toFileName('a.ts'));
		expect(await resolver.getAutoImportComponents(toFileName('a.ts'))).toBe(components);
		resolver.fileChanged(toFileName('bar.ts'));
		expect(await getNames()).toEqual(['Bar', 'Foo']);

		writeComponent('foo.ts', 'Baz');
		await server.request('vue/sync', {}).catch(() => {});
		expect(await getNames()).toEqual(['Bar', 'Foo']);
		resolver.invalidate();
		expect(await getNames()).toEqual(['Bar', 'Baz']);
	}
	finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test('a change to a file that cannot export components keeps the auto-import components', async () => {
	const dir = fs.mkdtempSync(path.join(testWorkspacePath, 'auto-import-cache-'));
	try {
		const toFileName = (file: string) => path.join(dir, file).replace(/\\/g, '/');
		fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({ include: ['*.ts'] }));
		fs.writeFileSync(path.join(dir, 'a.ts'), 'export {};\n');
		const components = await resolver.getAutoImportComponents(toFileName('a.ts'));
		expect(components).toBeDefined();

		resolver.fileChanged(toFileName('notes.md'));
		expect(await resolver.getAutoImportComponents(toFileName('a.ts'))).toBe(components);
		resolver.fileChanged(toFileName('b.ts'));
		expect(await resolver.getAutoImportComponents(toFileName('a.ts'))).not.toBe(components);
	}
	finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test('a .vue file no content mapper covers has no project', async () => {
	expect(await resolver.getProject(fileName('fixture.vue'))).toBeUndefined();
});

test('element names come from the intrinsic elements of Vue', async () => {
	const elementNames = await resolver.getElementNames(...vueFile('tsconfigProject/empty.vue'));
	expect(elementNames).toContain('div');
	expect(elementNames).toContain('svg');
});

test('a .vue file no content mapper covers has no element names', async () => {
	expect(await resolver.getElementNames(...vueFile('fixture.vue'))).toBeUndefined();
});

test('directive names come from the global directives of Vue', async () => {
	const directives = await resolver.getComponentDirectives(...vueFile('tsconfigProject/empty.vue'));
	expect(directives).toContain('vShow');
	expect(directives).not.toContain('Transition');
});

test('a .vue file no content mapper covers has no directive names', async () => {
	expect(await resolver.getComponentDirectives(...vueFile('fixture.vue'))).toBeUndefined();
});

/** A workspace Vue file name and its virtual code, as the language server passes them. */
function vueFile(file: string): [string, VueVirtualCode] {
	const name = fileName(file);
	const text = fs.existsSync(name) ? fs.readFileSync(name, 'utf8') : '';
	const plugin = createVueLanguagePlugin<string>(asCoreTypeScript(ts), getDefaultCompilerOptions(), id => id);
	const snapshot = {
		getText: (start: number, end: number) => text.slice(start, end),
		getLength: () => text.length,
		getChangeRange: () => undefined,
	};
	return [name, plugin.createVirtualCode!(name, 'vue', snapshot, {} as any) as VueVirtualCode];
}

test('a closed file resolves again when asked later', async () => {
	resolver.closeFile(fileName('typescriptProject/jsconfig/a.js'));
	await expectConfigFileName('typescriptProject/jsconfig/a.js', 'typescriptProject/jsconfig/jsconfig.json');
});
