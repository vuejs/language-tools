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
import * as CompilerDOM from '@vue/compiler-dom';

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

export interface ITemplateScriptData {
	projectVersion: string | undefined;
	context: string[];
	contextItems: vscode.CompletionItem[];
	components: string[];
	componentItems: vscode.CompletionItem[];
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

export interface VueCompilerOptions {
	experimentalCompatMode?: 2 | 3;
	experimentalTemplateCompilerOptions?: CompilerDOM.CompilerOptions;
	experimentalTemplateCompilerOptionsRequirePath?: string;
}

export type LanguageServiceContextBase = {
	compilerOptions: VueCompilerOptions,
	modules: Modules,
	htmlLs: html.LanguageService,
	pugLs: pug.LanguageService,
	jsonLs: json.LanguageService,
	getCssLs: (lang: string) => css.LanguageService | undefined,
}
export type HtmlLanguageServiceContext = LanguageServiceContextBase & {
	getHtmlDocument(document: TextDocument): HTMLDocument | undefined;
	getVueDocument(document: TextDocument): SourceFile | undefined;
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
	getTextDocument(uri: string): TextDocument | undefined;
}
export type LanguageServiceContext = ApiLanguageServiceContext | HtmlLanguageServiceContext;
