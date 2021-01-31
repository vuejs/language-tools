import type { CompletionItem } from 'vscode-languageserver/node';
import type { SourceFile } from './sourceFile';
import type { TsSourceMap } from './utils/sourceMaps';
import type * as ts2 from '@volar/vscode-typescript-languageservice';
import type { TextDocument } from 'vscode-css-languageservice';
import type { HTMLDocument } from 'vscode-html-languageservice';
import type { createMapper } from './utils/mapper';

export interface TsCompletionData {
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

export type CompletionData = TsCompletionData | HtmlCompletionData | CssCompletionData;

export interface IDescriptorBlock {
	lang: string;
	content: string;
	loc: {
		start: number;
		end: number;
	};
	ignore: boolean;
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
	components: string[];
	props: string[];
	setupReturns: string[];
	htmlElements: string[];
}

export type HtmlApiRegisterOptions = {
	ts: typeof import('typescript');
	getHtmlDocument(document: TextDocument): HTMLDocument;
}
export type TsApiRegisterOptions = {
	ts: typeof import('typescript');
	sourceFiles: Map<string, SourceFile>;
	tsLanguageService: ts2.LanguageService;
	getGlobalTsSourceMaps?: () => Map<string, { sourceMap: TsSourceMap }>;
	vueHost: ts2.LanguageServiceHost;
	mapper: ReturnType<typeof createMapper>;
}
