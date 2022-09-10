import * as alpineTs from '@volar/alpine-language-core';
import * as vueLs from '@volar/vue-language-service';
import { EmbeddedLanguageServicePlugin, PluginContext } from '@volar/embedded-language-service';

export * from '@volar/vue-language-service';

export function createLanguageService(
	alpineLsHost: alpineTs.LanguageServiceHost,
	env: PluginContext['env'],
	customPlugins: EmbeddedLanguageServicePlugin[],
): ReturnType<typeof vueLs['createLanguageService']> {
	return vueLs.createLanguageService(
		{
			...alpineLsHost,
			getVueCompilationSettings: () => ({}),
		},
		env,
		customPlugins,
		[alpineTs.createEmbeddedLanguageModule(alpineLsHost)],
	);
}

export function getDocumentService(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	env: PluginContext['env'],
	customPlugins: EmbeddedLanguageServicePlugin[] = [],
): ReturnType<typeof vueLs['getDocumentService']> {
	return vueLs.getDocumentService(
		ts,
		env,
		customPlugins,
	);
}
