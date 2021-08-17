import type * as css from 'vscode-css-languageservice';
import type { DocumentContext, TextDocument } from 'vscode-css-languageservice';
import type * as html from 'vscode-html-languageservice';
import type { HTMLDocument } from 'vscode-html-languageservice';
import type * as json from 'vscode-json-languageservice';
import type * as vscode from 'vscode-languageserver';
import type * as pug from 'vscode-pug-languageservice';
import type * as ts2 from 'vscode-typescript-languageservice';
import type { LanguageServiceHost } from './languageService';
import type { SourceFile } from './sourceFile';
import type { SourceFiles } from './sourceFiles';

export interface TsCompletionData {
	lsType: 'template' | 'script',
	mode: 'ts',
	uri: string,
	docUri: string,
	tsItem: vscode.CompletionItem,
}
export interface HtmlCompletionData {
	mode: 'html',
	uri: string,
	docUri: string,
	tsItem: vscode.CompletionItem | undefined,
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
		module: string | undefined;
		scoped: boolean;
	})[];
	customBlocks: (IDescriptorBlock & {
		type: string;
	})[];
}
export interface ITemplateScriptData {
	projectVersion: string | undefined;
	context: string[];
	componentItems: vscode.CompletionItem[];
	components: string[];
	props: string[];
	setupReturns: string[];
}

export type Modules = {
	typescript: typeof import('typescript/lib/tsserverlibrary'),
	ts: typeof import('vscode-typescript-languageservice'),
	css: typeof import('vscode-css-languageservice'),
	html: typeof import('vscode-html-languageservice'),
	json: typeof import('vscode-json-languageservice'),
	pug: typeof import('vscode-pug-languageservice'),
	emmet: typeof import('@vscode/emmet-helper'),
};

export type LanguageServiceContextBase = {
	isVue2Mode: boolean,
	modules: Modules,
	htmlLs: html.LanguageService,
	pugLs: pug.LanguageService,
	jsonLs: json.LanguageService,
	getCssLs: (lang: string) => css.LanguageService | undefined,
}
export type HtmlLanguageServiceContext = LanguageServiceContextBase & {
	getHtmlDocument(document: TextDocument): HTMLDocument;
	getVueDocument(document: TextDocument): SourceFile;
}
export type ApiLanguageServiceContext = LanguageServiceContextBase & {
	sourceFiles: SourceFiles;
	vueHost: LanguageServiceHost;
	documentContext: DocumentContext;
	scriptTsHost: ts.LanguageServiceHost;
	templateTsHost: ts.LanguageServiceHost;
	scriptTsLsRaw: ts.LanguageService;
	templateTsLsRaw: ts.LanguageService;
	scriptTsLs: ts2.LanguageService;
	templateTsLs: ts2.LanguageService;
	getTsLs: (lsType: 'template' | 'script') => ts2.LanguageService;
}
export type LanguageServiceContext = ApiLanguageServiceContext | HtmlLanguageServiceContext;
