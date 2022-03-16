import type * as css from 'vscode-css-languageservice';
import type { DocumentContext, TextDocument } from 'vscode-css-languageservice';
import type * as html from 'vscode-html-languageservice';
import type * as pug from '@volar/pug-language-service';
import type { VueDocuments } from './vueDocuments';
import type { TextRange } from './utils/sourceMaps';
import type * as ts from 'typescript/lib/tsserverlibrary';

export type LanguageServiceHostBase = ts.LanguageServiceHost & {
	getVueCompilationSettings?(): VueCompilerOptions,
	getVueProjectVersion?(): string;
};

export interface ITemplateScriptData {
	projectVersion: string | undefined;
	context: string[];
	contextItems: ts.CompletionEntry[];
	components: string[];
	componentItems: ts.CompletionEntry[];
	props: string[];
	setupReturns: string[];
}

export interface VueCompilerOptions {
	experimentalCompatMode?: 2 | 3;
	experimentalTemplateCompilerOptions?: any;
	experimentalTemplateCompilerOptionsRequirePath?: string;
	experimentalDisableTemplateSupport?: boolean;
}

export type BasicRuntimeContext = {
	typescript: typeof import('typescript/lib/tsserverlibrary'),
	vueCompilerOptions: VueCompilerOptions,
	compileTemplate(templateText: string, templateLang: string): {
		htmlText: string;
		htmlToTemplate: (start: number, end: number) => { start: number, end: number } | undefined;
	} | undefined
	getCssVBindRanges: (documrnt: TextDocument) => TextRange[],
	getCssClasses: (documrnt: TextDocument) => Record<string, TextRange[]>,

	htmlLs: html.LanguageService,
	pugLs: pug.LanguageService,
	getCssLs: (lang: string) => css.LanguageService | undefined,
}

export type TypeScriptFeaturesRuntimeContext = {
	vueDocuments: VueDocuments;
	vueHost: LanguageServiceHostBase;
	documentContext: DocumentContext;
	scriptTsHost: ts.LanguageServiceHost;
	templateTsHost: ts.LanguageServiceHost | undefined;
	scriptTsLsRaw: ts.LanguageService;
	templateTsLsRaw: ts.LanguageService | undefined;
	getTsLs: <T extends 'template' | 'script'>(lsType: T) => T extends 'script' ? ts.LanguageService : (ts.LanguageService | undefined);
}
