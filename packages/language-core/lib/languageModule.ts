import { forEachEmbeddedCode, type LanguagePlugin } from '@volar/language-core';
import type * as ts from 'typescript';
import { getDefaultVueLanguagePlugins } from './plugins';
import type { VueCompilerOptions, VueLanguagePlugin } from './types';
import { VueGeneratedCode } from './virtualFile/vueFile';
import * as CompilerDOM from '@vue/compiler-dom';
import * as CompilerVue2 from './utils/vue2TemplateCompiler';

const normalFileRegistries: {
	key: string;
	plugins: VueLanguagePlugin[];
	files: Map<string, VueGeneratedCode>;
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
	plugins: ReturnType<VueLanguagePlugin>[],
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

export function createVueLanguagePlugin(
	ts: typeof import('typescript'),
	getFileName: (fileId: string) => string,
	isValidGlobalTypesHolder: (fileName: string) => boolean,
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	codegenStack: boolean = false,
): LanguagePlugin<VueGeneratedCode> {
	const allowLanguageIds = new Set(['vue']);
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
		codegenStack,
		globalTypesHolder: undefined,
	};
	const plugins = getDefaultVueLanguagePlugins(pluginContext);

	if (vueCompilerOptions.extensions.includes('.md')) {
		allowLanguageIds.add('markdown');
	}
	if (vueCompilerOptions.extensions.includes('.html')) {
		allowLanguageIds.add('html');
	}

	return {
		createVirtualCode(fileId, languageId, snapshot) {
			if (allowLanguageIds.has(languageId)) {
				const fileName = getFileName(fileId);
				if (!pluginContext.globalTypesHolder && isValidGlobalTypesHolder(fileName)) {
					pluginContext.globalTypesHolder = fileName;
				}
				const fileRegistry = getFileRegistry(pluginContext.globalTypesHolder === fileName);
				const code = fileRegistry.get(fileId);
				if (code) {
					code.update(snapshot);
					return code;
				}
				else {
					const code = new VueGeneratedCode(
						fileName,
						languageId,
						snapshot,
						vueCompilerOptions,
						plugins,
						ts,
						codegenStack,
					);
					fileRegistry.set(fileId, code);
					return code;
				}
			}
		},
		updateVirtualCode(_fileId, code, snapshot) {
			code.update(snapshot);
			return code;
		},
		disposeVirtualCode(fileId, code, files) {
			const isGlobalTypesHolder = code.fileName === pluginContext.globalTypesHolder;
			const fileRegistry = getFileRegistry(isGlobalTypesHolder);
			fileRegistry.delete(fileId);
			if (isGlobalTypesHolder) {
				pluginContext.globalTypesHolder = undefined;
				const fileRegistry2 = getFileRegistry(false);
				for (const [fileId, code] of fileRegistry2) {
					if (isValidGlobalTypesHolder(code.fileName)) {
						pluginContext.globalTypesHolder = code.fileName;
						fileRegistry2.delete(fileId);
						// force dirty
						files?.delete(fileId);
						files?.set(
							fileId,
							code.languageId,
							code.snapshot,
						);
						break;
					}
				}
			}
		},
		typescript: {
			extraFileExtensions: vueCompilerOptions.extensions.map<ts.FileExtensionInfo>(ext => ({
				extension: ext.slice(1),
				isMixedContent: true,
				scriptKind: 7 satisfies ts.ScriptKind.Deferred,
			})),
			getScript(rootVirtualCode) {
				for (const code of forEachEmbeddedCode(rootVirtualCode)) {
					if (code.id.startsWith('script_')) {
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
			vueCompilerOptions.plugins,
		);
	}
}
