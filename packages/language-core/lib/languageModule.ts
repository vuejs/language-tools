import { forEachEmbeddedCode, type LanguagePlugin } from '@volar/language-core';
import type * as ts from 'typescript';
import { getBasePlugins } from './plugins';
import type { VueCompilerOptions, VueLanguagePlugin } from './types';
import { VueVirtualCode } from './virtualFile/vueFile';
import * as CompilerDOM from '@vue/compiler-dom';
import * as CompilerVue2 from './utils/vue2TemplateCompiler';
import useHtmlFilePlugin from './plugins/file-html';
import useMdFilePlugin from './plugins/file-md';
import useVueFilePlugin from './plugins/file-vue';

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

export function createVueLanguagePlugin<T>(
	ts: typeof import('typescript'),
	asFileName: (scriptId: T) => string,
	getProjectVersion: () => string,
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
	const basePlugins = getBasePlugins(pluginContext);
	const vueSfcPlugin = useVueFilePlugin(pluginContext);
	const vitePressSfcPlugin = useMdFilePlugin(pluginContext);
	const petiteVueSfcPlugin = useHtmlFilePlugin(pluginContext);

	let canonicalRootFileNamesVersion: string | undefined;

	return {
		getLanguageId(scriptId) {
			if (vueCompilerOptions.extensions.some(ext => asFileName(scriptId).endsWith(ext))) {
				return 'vue';
			}
			if (vueCompilerOptions.vitePressExtensions.some(ext => asFileName(scriptId).endsWith(ext))) {
				return 'markdown';
			}
			if (vueCompilerOptions.petiteVueExtensions.some(ext => asFileName(scriptId).endsWith(ext))) {
				return 'html';
			}
		},
		createVirtualCode(scriptId, languageId, snapshot) {
			if (languageId === 'vue' || languageId === 'markdown' || languageId === 'html') {
				const fileName = asFileName(scriptId);
				if (!pluginContext.globalTypesHolder && getProjectVersion() !== canonicalRootFileNamesVersion) {
					canonicalRootFileNamesVersion = getProjectVersion();
					if (isRootFile(fileName)) {
						pluginContext.globalTypesHolder = fileName;
					}
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
						languageId === 'html'
							? [petiteVueSfcPlugin, ...basePlugins]
							: languageId === 'markdown'
								? [vitePressSfcPlugin, ...basePlugins]
								: [vueSfcPlugin, ...basePlugins],
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
			extraFileExtensions: [
				...vueCompilerOptions.extensions,
				...vueCompilerOptions.vitePressExtensions,
				...vueCompilerOptions.petiteVueExtensions,
			].map<ts.FileExtensionInfo>(ext => ({
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
			getFileRegistryKey(compilerOptions, vueCompilerOptions, basePlugins),
			vueCompilerOptions.plugins
		);
	}
}
