import * as base from '@volar/typescript';
import * as vue from '@volar/vue-language-core';
import * as _ from 'typescript/lib/tsserverlibrary';

export function createLanguageService(host: vue.VueLanguageServiceHost) {
	const ts = host.getTypeScriptModule?.();
	if (!ts) {
		throw new Error('TypeScript module not provided.');
	}
	const languageService = base.createLanguageService(host, vue.createLanguageModules(
		ts,
		host.getCompilationSettings(),
		vue.resolveVueCompilerOptions(host.getVueCompilationSettings()),
	));
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
