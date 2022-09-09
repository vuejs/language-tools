import * as alpineTs from '@volar/alpine-language-core';
import * as vueLs from '@volar/vue-language-service';
import { ConfigurationHost, EmbeddedLanguageServicePlugin } from '@volar/embedded-language-service';
import { URI } from 'vscode-uri';

export function createLanguageService(
	alpineLsHost: alpineTs.LanguageServiceHost,
	configurationHost: ConfigurationHost | undefined,
	customPlugins: EmbeddedLanguageServicePlugin[],
	rootUri = URI.file(alpineLsHost.getCurrentDirectory()),
): ReturnType<typeof vueLs['createLanguageService']> {
	return vueLs.createLanguageService(
		{
			...alpineLsHost,
			getVueCompilationSettings: () => ({}),
		},
		undefined,
		undefined,
		configurationHost,
		customPlugins,
		() => alpineTs.createLanguageContext(alpineLsHost, [alpineTs.createEmbeddedLanguageModule(alpineLsHost)]),
		rootUri,
	);
}

export function getDocumentService(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	configurationHost: ConfigurationHost | undefined,
	customPlugins: EmbeddedLanguageServicePlugin[],
	rootUri = URI.file(ts.sys.getCurrentDirectory()),
): ReturnType<typeof vueLs['getDocumentService']> {
	return vueLs.getDocumentService(
		ts,
		configurationHost,
		undefined,
		customPlugins,
		rootUri,
	);
}
