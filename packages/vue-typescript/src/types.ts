import type * as css from 'vscode-css-languageservice';
import type { DocumentContext, TextDocument } from 'vscode-css-languageservice';
import type * as html from 'vscode-html-languageservice';
import type * as json from 'vscode-json-languageservice';
import type * as vscode from 'vscode-languageserver-protocol';
import type * as pug from 'vscode-pug-languageservice';
import type * as ts2 from 'vscode-typescript-languageservice';
import type { VueDocuments } from './vueDocuments';
import type { TextRange } from './utils/sourceMaps';

export type LanguageServiceHostBase = ts2.LanguageServiceHost & {
    getVueCompilationSettings?(): VueCompilerOptions,
    getVueProjectVersion?(): string;
};

export interface ITemplateScriptData {
	projectVersion: string | undefined;
	context: string[];
	contextItems: vscode.CompletionItem[];
	components: string[];
	componentItems: vscode.CompletionItem[];
	props: string[];
	setupReturns: string[];
}

export interface VueCompilerOptions {
	experimentalCompatMode?: 2 | 3;
	experimentalTemplateCompilerOptions?: any;
	experimentalTemplateCompilerOptionsRequirePath?: string;
}

export type BasicRuntimeContext = {
	typescript: typeof import('typescript/lib/tsserverlibrary'),
	compilerOptions: VueCompilerOptions,
	compileTemplate(templateTextDocument: TextDocument): {
		htmlTextDocument: TextDocument;
		htmlToTemplate: (start: number, end: number) => number | undefined;
	} | undefined
	getCssVBindRanges: (documrnt: TextDocument) => TextRange[],
	getCssClasses: (documrnt: TextDocument) => Record<string, [number, number][]>,

	htmlLs: html.LanguageService,
	pugLs: pug.LanguageService,
	jsonLs: json.LanguageService,
	getCssLs: (lang: string) => css.LanguageService | undefined,
	getStylesheet: (documrnt: TextDocument) => css.Stylesheet | undefined,
	getHtmlDocument: (documrnt: TextDocument) => html.HTMLDocument | undefined,
	getJsonDocument: (documrnt: TextDocument) => json.JSONDocument | undefined,
	getPugDocument: (documrnt: TextDocument) => pug.PugDocument | undefined,
}

export type TypeScriptFeaturesRuntimeContext = {
	vueDocuments: VueDocuments;
	vueHost: LanguageServiceHostBase;
	documentContext: DocumentContext;
	scriptTsHost: ts.LanguageServiceHost;
	templateTsHost: ts.LanguageServiceHost;
	scriptTsLsRaw: ts.LanguageService;
	templateTsLsRaw: ts.LanguageService;
	scriptTsLs: ts2.LanguageService;
	templateTsLs: ts2.LanguageService;
	getTsLs: (lsType: 'template' | 'script') => ts2.LanguageService;
}
