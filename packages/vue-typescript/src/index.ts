import { createLanguageServiceHost, getDocumentRegistry, decorateLanguageService as _decorateLanguageService } from '@volar/typescript';
import * as vue from '@vue/language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';

export { getProgram, decorateLanguageServiceHost, getExternalFiles } from '@volar/typescript';

export function createLanguageService(
	host: vue.TypeScriptLanguageHost,
	vueCompilerOptions: Partial<vue.VueCompilerOptions>,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	sys: ts.System,
) {
	const languageContext = vue.createLanguageContext(
		host,
		vue.createLanguages(
			host.getCompilationSettings(),
			vueCompilerOptions,
			ts,
		),
	);
	const languageServiceHost = createLanguageServiceHost(languageContext, ts, sys, undefined);
	const languageService = ts.createLanguageService(languageServiceHost, getDocumentRegistry(ts, sys.useCaseSensitiveFileNames, host.workspacePath));
	decorateLanguageService(languageContext.virtualFiles, languageService, false);
	return {
		...languageService,
		__internal__: {
			context: languageContext,
		},
	};
}

export function decorateLanguageService(virtualFiles: vue.VirtualFiles, ls: ts.LanguageService, isTsPlugin: boolean) {

	_decorateLanguageService(virtualFiles, ls, isTsPlugin);

	const getCompletionsAtPosition = ls.getCompletionsAtPosition.bind(ls);
	ls.getCompletionsAtPosition = (fileName, position, options) => {
		const result = getCompletionsAtPosition(fileName, position, options);
		if (result) {
			result.entries = result.entries.filter(entry => entry.name.indexOf('__VLS_') === -1);
		}
		return result;
	};
}
