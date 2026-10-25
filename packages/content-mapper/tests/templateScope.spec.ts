import {
	createVueLanguagePlugin,
	forEachEmbeddedCode,
	type VueVirtualCode,
} from '@vue/language-core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts5 from 'typescript-5';
import { expect, test } from 'vitest';
import vueTsxPlugin, { tsCodegen } from '../lib/vueTsx';
import { loadTypeScript } from '../typescript';
import { resolveMapperOptions } from '../vueOptions';
import { createSnapshot, repositoryRoot } from './utils';

const workspace = path.join(repositoryRoot, 'test-workspace');

interface MapperEntry {
	package: string;
	extensions?: string[];
	options?: Record<string, unknown>;
}

function readContentMappers(configFile: string): MapperEntry[] | undefined {
	const { config } = ts5.readConfigFile(configFile, ts5.sys.readFile);
	if (config?.contentMappers) {
		return config.contentMappers;
	}
	if (typeof config?.extends === 'string') {
		return readContentMappers(path.resolve(path.dirname(configFile), config.extends));
	}
}

/** The nearest tsconfig with a `@vue/content-mapper` entry for the file, as the TypeScript 7.1 project would pick. */
function findMapperEntry(fileName: string): [configFile: string | undefined, entry: MapperEntry | undefined] {
	for (let dir = path.dirname(fileName); dir.startsWith(workspace); dir = path.dirname(dir)) {
		const configFile = path.join(dir, 'tsconfig.json');
		if (fs.existsSync(configFile)) {
			const entry = readContentMappers(configFile)
				?.filter(entry => entry.package === '@vue/content-mapper')
				.find(entry => entry.extensions?.some(extension => fileName.endsWith(extension)));
			if (entry) {
				return [configFile, entry];
			}
		}
	}
	return [undefined, undefined];
}

function findVueFiles(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			return entry.name === 'node_modules' ? [] : findVueFiles(fullPath);
		}
		return entry.name.endsWith('.vue') ? [fullPath] : [];
	}).sort();
}

test('the template scope names and inlay hints of language-core match the code generation', () => {
	const ts = loadTypeScript();
	const files = findVueFiles(workspace);
	const differences: string[] = [];

	for (const fileName of files) {
		const [configFile, entry] = findMapperEntry(fileName);
		const { vueOptions } = resolveMapperOptions(ts5.sys.readFile, configFile, entry?.options);
		const plugin = createVueLanguagePlugin<string>(ts, vueOptions, id => id, [vueTsxPlugin]);
		const content = fs.readFileSync(fileName, 'utf8');
		const root = plugin.createVirtualCode!(fileName, 'vue', createSnapshot(content), {} as any) as VueVirtualCode;
		[...forEachEmbeddedCode(root)];
		const codegen = tsCodegen.get(root.ir)!;

		const { getScopeBindings, getTemplateScope, getInlayHints } = root.scriptAnalysis;
		const relative = path.relative(workspace, fileName);
		const compare = (what: string, actual: unknown, expected: unknown) => {
			if (JSON.stringify(actual) !== JSON.stringify(expected)) {
				differences.push(`${relative} ${what}\n  language-core: ${JSON.stringify(actual)}\n  codegen:       ${JSON.stringify(expected)}`);
			}
		};
		compare('scope bindings', [...getScopeBindings()], [...codegen.getScopeBindings()]);
		compare(
			'template scope members',
			[...getTemplateScope().templateNames],
			[...codegen.getGeneratedTemplate()?.scopeMemberNames ?? []],
		);
		compare(
			'inlay hints',
			getInlayHints(),
			[...codegen.getGeneratedTemplate()?.inlayHints ?? [], ...codegen.getGeneratedScript().inlayHints],
		);
	}

	expect(files.length).toBeGreaterThan(400);
	expect(differences).toEqual([]);
});
