import type { LanguagePlugin } from '@volar/language-core';
import * as path from 'path-browserify';
import { getDefaultVueLanguagePlugins } from './plugins';
import { VueFile } from './virtualFile/vueFile';
import { VueCompilerOptions, VueLanguagePlugin } from './types';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { resolveVueCompilerOptions } from './utils/ts';

const fileRegistries: {
	key: string;
	plugins: VueLanguagePlugin[];
	files: Map<string, VueFile>;
}[] = [];

function getVueFileRegistry(key: string, plugins: VueLanguagePlugin[]) {

	let fileRegistry = fileRegistries.find(r =>
		r.key === key
		&& r.plugins.length === plugins.length
		&& r.plugins.every(plugin => plugins.includes(plugin))
	)?.files;

	if (!fileRegistry) {
		fileRegistry = new Map();
		fileRegistries.push({
			key: key,
			plugins: plugins,
			files: fileRegistry,
		});
	}

	return fileRegistry;
}

export function createVueLanguage(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	compilerOptions: ts.CompilerOptions = {},
	_vueCompilerOptions: Partial<VueCompilerOptions> = {},
	codegenStack: boolean = false,
	globalTypesHolder?: string
): LanguagePlugin<VueFile> {

	const vueCompilerOptions = resolveVueCompilerOptions(_vueCompilerOptions);
	const allowLanguageIds = new Set(['vue']);

	if (vueCompilerOptions.extensions.includes('.md')) {
		allowLanguageIds.add('markdown');
	}
	if (vueCompilerOptions.extensions.includes('.html')) {
		allowLanguageIds.add('html');
	}

	let fileRegistry: Map<string, VueFile> | undefined;
	let plugins: ReturnType<VueLanguagePlugin>[] = [];

	return {
		createVirtualFile(fileName, languageId, snapshot) {
			if (allowLanguageIds.has(languageId)) {

				if (!fileRegistry) {

					globalTypesHolder ??= fileName;

					const keys = [
						globalTypesHolder,
						...Object.keys(vueCompilerOptions)
							.sort()
							.filter(key => key !== 'plugins')
							.map(key => [key, vueCompilerOptions[key as keyof VueCompilerOptions]]),
						[...new Set(plugins.map(plugin => plugin.requiredCompilerOptions ?? []).flat())]
							.sort()
							.map(key => [key, compilerOptions[key as keyof ts.CompilerOptions]]),
					];

					fileRegistry = getVueFileRegistry(
						JSON.stringify(keys),
						vueCompilerOptions.plugins,
					);
					plugins = getDefaultVueLanguagePlugins(
						ts,
						compilerOptions,
						vueCompilerOptions,
						codegenStack,
						globalTypesHolder,
					);
				}

				if (fileRegistry.has(fileName)) {
					const reusedVueFile = fileRegistry.get(fileName)!;
					reusedVueFile.update(snapshot);
					return reusedVueFile;
				}
				const vueFile = new VueFile(fileName, languageId, snapshot, vueCompilerOptions, plugins, ts, codegenStack);
				fileRegistry.set(fileName, vueFile);
				return vueFile;
			}
		},
		updateVirtualFile(sourceFile, snapshot) {
			sourceFile.update(snapshot);
		},
		typescript: {
			resolveSourceFileName(tsFileName) {
				const baseName = path.basename(tsFileName);
				if (baseName.indexOf('.vue.') >= 0) { // .vue.ts .vue.d.ts .vue.js .vue.jsx .vue.tsx
					return tsFileName.substring(0, tsFileName.lastIndexOf('.vue.') + '.vue'.length);
				}
			},
			resolveModuleName(moduleName, impliedNodeFormat) {
				if (impliedNodeFormat === 99 satisfies ts.ModuleKind.ESNext && vueCompilerOptions.extensions.some(ext => moduleName.endsWith(ext))) {
					return `${moduleName}.js`;
				}
			},
		},
	};
}

/**
 * @deprecated planed to remove in 2.0, please use createVueLanguage instead of
 */
export function createLanguages(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	compilerOptions: ts.CompilerOptions = {},
	vueCompilerOptions: Partial<VueCompilerOptions> = {},
	codegenStack: boolean = false,
	globalTypesHolder?: string
): LanguagePlugin[] {
	return [
		createVueLanguage(ts, compilerOptions, vueCompilerOptions, codegenStack, globalTypesHolder),
		...vueCompilerOptions.experimentalAdditionalLanguageModules?.map(module => require(module)) ?? [],
	];
}
