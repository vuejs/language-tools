import { createVueLanguagePlugin, type VueVirtualCode } from '@vue/language-core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts5 from 'typescript-5';
import { expect, test } from 'vitest';
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

// The snapshot was recorded while a comparison with the `scopeMemberNames`, `getScopeBindings` and `inlayHints`
// outputs of the code generation found no difference; the code generation now reads the scope bindings from here.
test('the template scope and inlay hints of the Vue files of test-workspace', () => {
	const ts = loadTypeScript();
	const files = findVueFiles(workspace);
	const result: Record<string, unknown> = {};

	for (const fileName of files) {
		const [configFile, entry] = findMapperEntry(fileName);
		const { vueOptions } = resolveMapperOptions(ts5.sys.readFile, configFile, entry?.options);
		const plugin = createVueLanguagePlugin<string>(ts, vueOptions, id => id);
		// offsets independent of the line endings of the checkout
		const content = fs.readFileSync(fileName, 'utf8').replaceAll('\r\n', '\n');
		const root = plugin.createVirtualCode!(fileName, 'vue', createSnapshot(content), {} as any) as VueVirtualCode;
		const { getScopeBindings, getTemplateScope, getInlayHints } = root.scriptAnalysis;
		const { templateNames, styleNames } = getTemplateScope();
		const scopeBindings = getScopeBindings();
		const inlayHints = getInlayHints();
		if (templateNames.size || styleNames.size || scopeBindings.size || inlayHints.length) {
			result[path.relative(workspace, fileName).replaceAll('\\', '/')] = {
				templateNames: [...templateNames].join(' '),
				styleNames: [...styleNames].join(' '),
				scopeBindings: [...scopeBindings].join(' '),
				inlayHints: inlayHints.map(hint => `${hint.blockName}@${hint.offset} ${hint.label}`),
			};
		}
	}

	expect(files.length).toBeGreaterThan(400);
	expect(result).toMatchSnapshot();
});
