import * as base from '@volar/typescript';
import * as vue from '@vue/language-core';

export function createLanguageService(
	host: vue.VueLanguageServiceHost,
	ts: typeof import('typescript/lib/tsserverlibrary') = require('typescript'),
) {
	const languageService = base.createLanguageService(
		host,
		vue.createLanguages(
			ts,
			host.getCompilationSettings(),
			vue.resolveVueCompilerOptions(host.getVueCompilationSettings()),
		),
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
