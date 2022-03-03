import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import type * as ts2 from 'vscode-typescript-languageservice';
import type * as css from 'vscode-css-languageservice';

type Promiseable<T> = T | Promise<T>;

export type EmbeddedLanguagePlugin = {
    onCompletion?(textDocument: TextDocument, position: vscode.Position, context: vscode.CompletionContext): Promiseable<vscode.CompletionItem[] | vscode.CompletionList | undefined>,
    onCompletionResolve?(item: vscode.CompletionItem): Promiseable<vscode.CompletionItem>,
    onHover?(textDocument: TextDocument, position: vscode.Position): Promiseable<vscode.Hover | undefined>,
};

export type PluginHost = {
    schemaRequestService?(uri: string): Thenable<string>,
	typescript: typeof import('typescript/lib/tsserverlibrary'),
    tsLs: ts2.LanguageService | undefined,
    getCssLs(lang: string): css.LanguageService | undefined,
    getStylesheet(document: TextDocument): css.Stylesheet | undefined,
};

export function definePlugin(_: (host: PluginHost) => EmbeddedLanguagePlugin) {
    return _;
}
