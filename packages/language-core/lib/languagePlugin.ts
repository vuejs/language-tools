/// <reference types="@volar/typescript" />

import { FileMap, forEachEmbeddedCode, type LanguagePlugin } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import { createPlugins } from './plugins';
import type { VueCompilerOptions, VueLanguagePlugin } from './types';
import * as CompilerVue2 from './utils/vue2TemplateCompiler';
import { VueVirtualCode } from './virtualFile/vueFile';

const normalFileRegistries: {
	key: string;
	plugins: VueLanguagePlugin[];
	files: Map<string, VueVirtualCode>;
}[] = [];
const holderFileRegistries: typeof normalFileRegistries = [];

function getVueFileRegistry(isGlobalTypesHolder: boolean, key: string, plugins: VueLanguagePlugin[]) {
	const fileRegistries = isGlobalTypesHolder ? holderFileRegistries : normalFileRegistries;
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

function getFileRegistryKey(
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	plugins: ReturnType<VueLanguagePlugin>[]
) {
	const values = [
		...Object.keys(vueCompilerOptions)
			.sort()
			.filter(key => key !== 'plugins')
			.map(key => [key, vueCompilerOptions[key as keyof VueCompilerOptions]]),
		[...new Set(plugins.map(plugin => plugin.requiredCompilerOptions ?? []).flat())]
			.sort()
			.map(key => [key, compilerOptions[key as keyof ts.CompilerOptions]]),
	];
	return JSON.stringify(values);
}

export function createRootFileChecker(
	getProjectVersion: (() => string) | undefined,
	getRootFileNames: () => string[],
	caseSensitive: boolean
) {
	const fileNames = new FileMap(caseSensitive);
	let projectVersion: string | undefined;
	return (fileName: string) => {
		if (!getProjectVersion || projectVersion !== getProjectVersion()) {
			projectVersion = getProjectVersion?.();
			fileNames.clear();
			for (const rootFileName of getRootFileNames()) {
				fileNames.set(rootFileName, undefined);
			}
		}
		return fileNames.has(fileName);
	};
}

// TODO: replace `createVueLanguagePlugin` with `createVueLanguagePlugin2` in 2.1
export function createVueLanguagePlugin<T>(
	ts: typeof import('typescript'),
	asFileName: (scriptId: T) => string,
	_getProjectVersion: (() => string) | undefined,
	isRootFile: (fileName: string) => boolean,
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions
): LanguagePlugin<T, VueVirtualCode> {
	return createVueLanguagePlugin2(
		ts,
		asFileName,
		isRootFile,
		compilerOptions,
		vueCompilerOptions,
	);
}

export function createVueLanguagePlugin2<T>(
	ts: typeof import('typescript'),
	asFileName: (scriptId: T) => string,
	isRootFile: (fileName: string) => boolean,
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions
): LanguagePlugin<T, VueVirtualCode> {
	const pluginContext: Parameters<VueLanguagePlugin>[0] = {
		modules: {
			'@vue/compiler-dom': vueCompilerOptions.target < 3
				? {
					...CompilerDOM,
					compile: CompilerVue2.compile,
				}
				: CompilerDOM,
			typescript: ts,
		},
		compilerOptions,
		vueCompilerOptions,
		globalTypesHolder: undefined,
	};
	const plugins = createPlugins(pluginContext);

	return {
		getLanguageId(scriptId) {
			const fileName = asFileName(scriptId);
			for (const plugin of plugins) {
				const languageId = plugin.getLanguageId?.(fileName);
				if (languageId) {
					return languageId;
				}
			}
		},
		createVirtualCode(scriptId, languageId, snapshot) {
			const fileName = asFileName(scriptId);
			if (plugins.some(plugin => plugin.isValidFile?.(fileName, languageId))) {
				if (!pluginContext.globalTypesHolder && isRootFile(fileName)) {
					pluginContext.globalTypesHolder = fileName;
				}
				const fileRegistry = getFileRegistry(pluginContext.globalTypesHolder === fileName);
				const code = fileRegistry.get(fileName);
				if (code) {
					code.update(snapshot);
					return code;
				}
				else {
					const code = new VueVirtualCode(
						fileName,
						languageId,
						snapshot,
						vueCompilerOptions,
						plugins,
						ts,
					);
					fileRegistry.set(fileName, code);
					return code;
				}
			}
		},
		updateVirtualCode(_fileId, code, snapshot) {
			code.update(snapshot);
			return code;
		},
		// TODO: when global types holder deleted, move global types to another file
		// disposeVirtualCode(fileId, code) {
		// 	const isGlobalTypesHolder = code.fileName === pluginContext.globalTypesHolder;
		// 	const fileRegistry = getFileRegistry(isGlobalTypesHolder);
		// 	fileRegistry.delete(fileId);
		// 	if (isGlobalTypesHolder) {
		// 		pluginContext.globalTypesHolder = undefined;
		// 		const fileRegistry2 = getFileRegistry(false);
		// 		for (const [fileId, code] of fileRegistry2) {
		// 			if (isValidGlobalTypesHolder(code.fileName)) {
		// 				pluginContext.globalTypesHolder = code.fileName;
		// 				fileRegistry2.delete(fileId);
		// 				// force dirty
		// 				files?.delete(fileId);
		// 				files?.set(
		// 					fileId,
		// 					code.languageId,
		// 					code.snapshot,
		// 				);
		// 				break;
		// 			}
		// 		}
		// 	}
		// },
		typescript: {
			extraFileExtensions: getAllExtensions(vueCompilerOptions)
				.map<ts.FileExtensionInfo>(ext => ({
					extension: ext.slice(1),
					isMixedContent: true,
					scriptKind: 7 satisfies ts.ScriptKind.Deferred,
				})),
			getServiceScript(root) {
				for (const code of forEachEmbeddedCode(root)) {
					if (/script_(js|jsx|ts|tsx)/.test(code.id)) {
						const lang = code.id.substring('script_'.length);
						return {
							code,
							extension: '.' + lang,
							scriptKind: lang === 'js' ? ts.ScriptKind.JS
								: lang === 'jsx' ? ts.ScriptKind.JSX
									: lang === 'tsx' ? ts.ScriptKind.TSX
										: ts.ScriptKind.TS,
						};
					}
				}
			},
		},
	};

	function getFileRegistry(isGlobalTypesHolder: boolean) {
		return getVueFileRegistry(
			isGlobalTypesHolder,
			getFileRegistryKey(compilerOptions, vueCompilerOptions, plugins),
			vueCompilerOptions.plugins
		);
	}
}

export function getAllExtensions(options: VueCompilerOptions) {
	const result = new Set<string>();
	for (const key in options) {
		if (key === 'extensions' || key.endsWith('Extensions')) {
			const value = options[key as keyof VueCompilerOptions];
			if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
				for (const ext of value) {
					result.add(ext);
				}
			}
		}
	}
	return [...result];
}
