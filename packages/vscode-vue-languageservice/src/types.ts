import type { CompletionItem } from 'vscode-languageserver/node';
import type * as ts2 from 'vscode-typescript-languageservice';
import type { TextDocument, DocumentContext } from 'vscode-css-languageservice';
import type { HTMLDocument } from 'vscode-html-languageservice';
import type { LanguageServiceHost } from './languageService';
import type * as css from 'vscode-css-languageservice';
import type * as html from 'vscode-html-languageservice';
import type * as json from 'vscode-json-languageservice';
import type * as pug from 'vscode-pug-languageservice';
import type { SourceFiles } from './sourceFiles';

export interface TsCompletionData {
	lsType: 'template' | 'script',
	mode: 'ts',
	uri: string,
	docUri: string,
	tsItem: CompletionItem,
}
export interface HtmlCompletionData {
	mode: 'html',
	uri: string,
	docUri: string,
	tsItem: CompletionItem | undefined,
}
export interface CssCompletionData {
	uri: string,
	docUri: string,
	mode: 'css',
}
export interface AutoImportComponentCompletionData {
	mode: 'autoImport',
	uri: string,
	importUri: string,
}

export type CompletionData = TsCompletionData | HtmlCompletionData | CssCompletionData | AutoImportComponentCompletionData;

export interface IDescriptorBlock {
	lang: string;
	content: string;
	loc: {
		start: number;
		end: number;
	};
}
export interface IDescriptor {
	template: IDescriptorBlock | null;
	script: (IDescriptorBlock & {
		src?: string;
	}) | null;
	scriptSetup: IDescriptorBlock | null;
	styles: (IDescriptorBlock & {
		module: boolean;
		scoped: boolean;
	})[];
	customBlocks: (IDescriptorBlock & {
		type: string;
	})[];
}
export interface ITemplateScriptData {
	projectVersion: string | undefined;
	context: string[];
	componentItems: CompletionItem[];
	components: string[];
	props: string[];
	setupReturns: string[];
	htmlElementItems: CompletionItem[];
	htmlElements: string[];
}

export type LanguageServiceContextBase = {
	ts: typeof import('typescript/lib/tsserverlibrary');
	htmlLs: html.LanguageService,
	pugLs: pug.LanguageService,
	jsonLs: json.LanguageService,
	getCssLs: (lang: string) => css.LanguageService | undefined,
}
export type HtmlLanguageServiceContext = LanguageServiceContextBase & {
	getHtmlDocument(document: TextDocument): HTMLDocument;
}
export type ApiLanguageServiceContext = LanguageServiceContextBase & {
	sourceFiles: SourceFiles;
	vueHost: LanguageServiceHost;
	documentContext: DocumentContext;
	scriptTsLs: ts2.LanguageService;
	templateTsLs: ts2.LanguageService;
	getTsLs: (lsType: 'template' | 'script') => ts2.LanguageService;
}
export type LanguageServiceContext = ApiLanguageServiceContext | HtmlLanguageServiceContext;
