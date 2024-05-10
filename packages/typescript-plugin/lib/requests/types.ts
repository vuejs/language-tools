import type { Language } from '@vue/language-core';
import type * as ts from 'typescript';

export interface RequestContext {
	typescript: typeof import('typescript');
	languageService: ts.LanguageService;
	languageServiceHost: ts.LanguageServiceHost;
	language: Language;
	isTsPlugin: boolean;
	getFileId: (fileName: string) => string;
}
