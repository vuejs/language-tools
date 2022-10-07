import * as base from '@volar/typescript';
import * as vue from '@volar/vue-language-core';

export function createLanguageService(host: vue.LanguageServiceHost) {
	const mods = [vue.createLanguageModule(
		host.getTypeScriptModule(),
		host.getCurrentDirectory(),
		host.getCompilationSettings(),
		host.getVueCompilationSettings(),
		['.vue']
	)];
	return base.createLanguageService(host, mods);
}
