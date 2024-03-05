import { forEachEmbeddedCode, type LanguagePlugin } from '@volar/language-core';
import type * as ts from 'typescript';
import { createPluginContext, getDefaultVueLanguagePlugins } from './plugins';
import type { VueCompilerOptions } from './types';
import { VueGeneratedCode } from './virtualFile/vueFile';

export function createVueLanguagePlugin(
	ts: typeof import('typescript'),
	getFileName: (fileId: string) => string,
	getGlobalTypesHolder: () => string | undefined,
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	codegenStack: boolean = false,
): LanguagePlugin<VueGeneratedCode> {
	const allowLanguageIds = new Set(['vue']);
	const pluginContext = createPluginContext(
		ts,
		compilerOptions,
		vueCompilerOptions,
		codegenStack,
		getGlobalTypesHolder,
	);
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
				return new VueGeneratedCode(
					getFileName(fileId),
					languageId,
					snapshot,
					vueCompilerOptions,
					plugins,
					ts,
					codegenStack,
				);
			}
		},
		updateVirtualCode(_fileId, vueFile, snapshot) {
			vueFile.update(snapshot);
			return vueFile;
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
