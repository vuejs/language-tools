import { CompletionItem } from 'vscode-languageserver';

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
}
export interface IDescriptor {
	template: IDescriptorBlock | null;
	script: IDescriptorBlock | null;
	scriptSetup: (IDescriptorBlock & {
		setup: string;
	}) | null;
	styles: (IDescriptorBlock & {
		module: boolean;
		scoped: boolean;
	})[];
}
export interface ITemplateScriptData {
    projectVersion: string | undefined;
    context: string[];
    components: string[];
    props: string[];
    setupReturns: string[];
    scriptSetupExports: string[];
    htmlElements: string[];
}