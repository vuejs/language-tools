import type { Language } from '@vue/language-core';
import type * as ts from 'typescript';

export interface RequestContext {
	typescript: typeof ts;
	languageService: ts.LanguageService;
	languageServiceHost: ts.LanguageServiceHost;
	language: Language<string>;
}
