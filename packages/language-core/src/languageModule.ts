import type { Language } from '@volar/language-core';
import * as path from 'path-browserify';
import { getDefaultVueLanguagePlugins } from './plugins';
import { VueFile } from './virtualFile/vueFile';
import { VueCompilerOptions, VueLanguagePlugin } from './types';
import * as sharedTypes from './utils/globalTypes';
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
): Language<VueFile> {

	const vueCompilerOptions = resolveVueCompilerOptions(_vueCompilerOptions);
	const plugins = getDefaultVueLanguagePlugins(
		ts,
		compilerOptions,
		vueCompilerOptions,
		codegenStack,
	);
	const keys = [
		...Object.keys(vueCompilerOptions)
			.sort()
			.filter(key => key !== 'plugins')
			.map(key => [key, vueCompilerOptions[key as keyof VueCompilerOptions]]),
		[...new Set(plugins.map(plugin => plugin.requiredCompilerOptions ?? []).flat())]
			.sort()
			.map(key => [key, compilerOptions[key as keyof ts.CompilerOptions]]),
	];
	const fileRegistry = getVueFileRegistry(JSON.stringify(keys), _vueCompilerOptions.plugins ?? []);

	const allowLanguageIds = new Set(['vue']);

	if (vueCompilerOptions.extensions.includes('.md')) {
		allowLanguageIds.add('markdown');
	}
	if (vueCompilerOptions.extensions.includes('.html')) {
		allowLanguageIds.add('html');
	}

	return {
		createVirtualFile(fileName, snapshot, languageId) {
			if (
				(languageId && allowLanguageIds.has(languageId))
				|| (!languageId && vueCompilerOptions.extensions.some(ext => fileName.endsWith(ext)))
			) {
				if (fileRegistry.has(fileName)) {
					const reusedVueFile = fileRegistry.get(fileName)!;
					reusedVueFile.update(snapshot);
					return reusedVueFile;
				}
				const vueFile = new VueFile(fileName, snapshot, vueCompilerOptions, plugins, ts, codegenStack);
				fileRegistry.set(fileName, vueFile);
				return vueFile;
			}
		},
		updateVirtualFile(sourceFile, snapshot) {
			sourceFile.update(snapshot);
		},
		resolveHost(host) {
			const sharedTypesSnapshot = ts.ScriptSnapshot.fromString(sharedTypes.getTypesCode(vueCompilerOptions));
			const sharedTypesFileName = path.join(host.rootPath, sharedTypes.baseName);
			return {
				...host,
				resolveModuleName(moduleName, impliedNodeFormat) {
					if (impliedNodeFormat === ts.ModuleKind.ESNext && vueCompilerOptions.extensions.some(ext => moduleName.endsWith(ext))) {
						return `${moduleName}.js`;
					}
					return host.resolveModuleName?.(moduleName, impliedNodeFormat) ?? moduleName;
				},
				getScriptFileNames() {
					return [
						sharedTypesFileName,
						...host.getScriptFileNames(),
					];
				},
				getScriptSnapshot(fileName) {
					if (fileName === sharedTypesFileName) {
						return sharedTypesSnapshot;
					}
					return host.getScriptSnapshot(fileName);
				},
			};
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
): Language[] {
	return [
		createVueLanguage(ts, compilerOptions, vueCompilerOptions, codegenStack),
		...vueCompilerOptions.experimentalAdditionalLanguageModules?.map(module => require(module)) ?? [],
	];
}
