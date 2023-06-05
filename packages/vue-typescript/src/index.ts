import * as base from '@volar/typescript';
import * as vue from '@vue/language-core';
import type { ServiceEnvironment } from '@volar/language-service';

export function createLanguageService(
	host: vue.TypeScriptLanguageHost,
	vueCompilerOptions: Partial<vue.VueCompilerOptions>,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	env: ServiceEnvironment,
) {
	const languageContext = vue.createLanguageContext(
		host,
		vue.createLanguages(
			host.getCompilationSettings(),
			vueCompilerOptions,
			ts,
		),
	);
	const sys = base.createSys(languageContext, ts, env);
	const languageService = base.createLanguageService(
		languageContext,
		ts,
		sys,
	);
	const getCompletionsAtPosition = languageService.getCompletionsAtPosition;
	languageService.getCompletionsAtPosition = (fileName, position, options) => {
		const result = getCompletionsAtPosition(fileName, position, options);
		if (result) {
			result.entries = result.entries.filter(entry => entry.name.indexOf('__VLS_') === -1);
		}
		return result;
	};
	return languageService;
}
