import { forEachEmbeddedCode, type LanguagePlugin } from '@volar/language-core';
import { getDefaultVueLanguagePlugins, createPluginContext } from './plugins';
import { VueGeneratedCode } from './virtualFile/vueFile';
import { VueCompilerOptions, VueLanguagePlugin } from './types';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { resolveVueCompilerOptions } from './utils/ts';

const fileRegistries: {
	key: string;
	plugins: VueLanguagePlugin[];
	files: Map<string, VueGeneratedCode>;
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

function getFileRegistryKey(
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	plugins: ReturnType<VueLanguagePlugin>[],
	globalTypesHolder: string | undefined,
) {
	const values = [
		globalTypesHolder,
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

export function createVueLanguage(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	getFileName: (fileId: string) => string,
	compilerOptions: ts.CompilerOptions = {},
	_vueCompilerOptions: Partial<VueCompilerOptions> = {},
	codegenStack: boolean = false,
	globalTypesHolder?: string
): LanguagePlugin<VueGeneratedCode> {

	const vueCompilerOptions = resolveVueCompilerOptions(_vueCompilerOptions);
	const allowLanguageIds = new Set(['vue']);
	const pluginContext = createPluginContext(
		ts,
		compilerOptions,
		vueCompilerOptions,
		codegenStack,
		globalTypesHolder,
	);
	const plugins = getDefaultVueLanguagePlugins(pluginContext);

	if (vueCompilerOptions.extensions.includes('.md')) {
		allowLanguageIds.add('markdown');
	}
	if (vueCompilerOptions.extensions.includes('.html')) {
		allowLanguageIds.add('html');
	}

	let generatedCodeRegistry: Map<string, VueGeneratedCode> | undefined;

	return {
		createVirtualCode(fileId, languageId, snapshot) {
			if (allowLanguageIds.has(languageId)) {

				const fileName = getFileName(fileId);

				if (!generatedCodeRegistry) {

					pluginContext.globalTypesHolder ??= fileName;

					generatedCodeRegistry = getVueFileRegistry(
						getFileRegistryKey(compilerOptions, vueCompilerOptions, plugins, pluginContext.globalTypesHolder),
						vueCompilerOptions.plugins,
					);
				}

				if (generatedCodeRegistry.has(fileId)) {
					const reusedResult = generatedCodeRegistry.get(fileId)!;
					reusedResult.update(snapshot);
					return reusedResult;
				}
				const vueFile = new VueGeneratedCode(fileName, languageId, snapshot, vueCompilerOptions, plugins, ts, codegenStack);
				generatedCodeRegistry.set(fileId, vueFile);
				return vueFile;
			}
		},
		updateVirtualCode(_fileId, vueFile, snapshot) {
			vueFile.update(snapshot);
			return vueFile;
		},
		disposeVirtualCode(fileId, vueFile, files) {
			generatedCodeRegistry?.delete(fileId);
			if (vueFile.fileName === pluginContext.globalTypesHolder) {
				if (generatedCodeRegistry?.size) {
					for (const [fileName, file] of generatedCodeRegistry!) {
						pluginContext.globalTypesHolder = fileName;

						generatedCodeRegistry = getVueFileRegistry(
							getFileRegistryKey(compilerOptions, vueCompilerOptions, plugins, pluginContext.globalTypesHolder),
							vueCompilerOptions.plugins,
						);

						files?.set(
							fileId,
							file.languageId,
							// force dirty
							{ ...file.snapshot },
						);
						break;
					}
				}
				else {
					generatedCodeRegistry = undefined;
					pluginContext.globalTypesHolder = undefined;
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
}

/**
 * @deprecated planed to remove in 2.0, please use createVueLanguage instead of
 */
export function createLanguages(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	getFileName: (fileId: string) => string,
	compilerOptions: ts.CompilerOptions = {},
	vueCompilerOptions: Partial<VueCompilerOptions> = {},
	codegenStack: boolean = false,
	globalTypesHolder?: string
): LanguagePlugin[] {
	return [
		createVueLanguage(ts, getFileName, compilerOptions, vueCompilerOptions, codegenStack, globalTypesHolder),
		...vueCompilerOptions.experimentalAdditionalLanguageModules?.map(module => require(module)) ?? [],
	];
}
