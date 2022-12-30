import * as base from '@volar/typescript';
import * as vue from '@volar/vue-language-core';

export function createLanguageService(host: vue.LanguageServiceHost) {
	return base.createLanguageService(host, vue.createLanguageModules(
		host.getTypeScriptModule(),
		host.getCurrentDirectory(),
		host.getCompilationSettings(),
		host.getVueCompilationSettings(),
	));
}
