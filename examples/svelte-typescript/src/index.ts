import * as base from '@volar/typescript';
import { languageModule, LanguageServiceHost } from '@volar-examples/svelte-language-core';

export function createLanguageService(host: LanguageServiceHost) {
	return base.createLanguageService(host, [languageModule]);
}
