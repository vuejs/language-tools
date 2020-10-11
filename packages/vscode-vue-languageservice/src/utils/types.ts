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
