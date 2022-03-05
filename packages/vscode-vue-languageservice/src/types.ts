import { BasicRuntimeContext, SourceFile, TypeScriptFeaturesRuntimeContext, LanguageServiceHostBase as LanguageServiceHostBase } from '@volar/vue-typescript';
import type * as emmet from '@vscode/emmet-helper';
import type * as css from 'vscode-css-languageservice';
import type { TextDocument } from 'vscode-css-languageservice';
import type * as html from 'vscode-html-languageservice';
import type * as json from 'vscode-json-languageservice';
import type * as vscode from 'vscode-languageserver-protocol';

export type LanguageServiceHost = LanguageServiceHostBase & {
    getEmmetConfig?(syntax: string): Promise<emmet.VSCodeEmmetConfig>,
    schemaRequestService?: json.SchemaRequestService,
    getCssLanguageSettings?(document: TextDocument): Promise<css.LanguageSettings>,
    getHtmlHoverSettings?(document: TextDocument): Promise<html.HoverSettings>,
};

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

export type DocumentServiceRuntimeContext = BasicRuntimeContext & {
	getVueDocument(document: TextDocument): SourceFile | undefined;
}

export type LanguageServiceRuntimeContext = TypeScriptFeaturesRuntimeContext & {
	vueHost: LanguageServiceHost;
	getTextDocument(uri: string): TextDocument | undefined;
}

export type RuntimeContext = LanguageServiceRuntimeContext | DocumentServiceRuntimeContext;
