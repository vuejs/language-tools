import { forEachEmbeddedCode, type LanguagePlugin } from '@volar/language-core';
import type * as ts from 'typescript';
import { getDefaultVueLanguagePlugins } from './plugins';
import type { VueCompilerOptions, VueLanguagePlugin } from './types';
import { VueGeneratedCode } from './virtualFile/vueFile';
import * as CompilerDOM from '@vue/compiler-dom';
import * as CompilerVue2 from './utils/vue2TemplateCompiler';

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

	const createdCodes = new Map<string, VueGeneratedCode>();

	return {
		createVirtualCode(fileId, languageId, snapshot) {
			if (allowLanguageIds.has(languageId)) {
				const fileName = getFileName(fileId);
				if (!pluginContext.globalTypesHolder && isValidGlobalTypesHolder(fileName)) {
					pluginContext.globalTypesHolder = fileName;
				}
				const code = new VueGeneratedCode(
					fileName,
					languageId,
					snapshot,
					vueCompilerOptions,
					plugins,
					ts,
					codegenStack,
				);
				createdCodes.set(fileId, code);
				return code;
			}
		},
		updateVirtualCode(_fileId, code, snapshot) {
			code.update(snapshot);
			return code;
		},
		disposeVirtualCode(fileId, code, files) {
			createdCodes.delete(fileId);
			if (code.fileName === pluginContext.globalTypesHolder) {
				pluginContext.globalTypesHolder = undefined;
				for (const [fileId, code] of createdCodes) {
					if (isValidGlobalTypesHolder(code.fileName)) {
						pluginContext.globalTypesHolder = code.fileName;
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
}
