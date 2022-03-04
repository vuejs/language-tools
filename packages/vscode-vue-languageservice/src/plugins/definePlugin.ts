import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import type * as ts2 from 'vscode-typescript-languageservice';
import type * as css from 'vscode-css-languageservice';
import * as html from 'vscode-html-languageservice';

type Promiseable<T> = T | Promise<T>;

export type EmbeddedLanguagePlugin = {
    onCompletion?(textDocument: TextDocument, position: vscode.Position, context: vscode.CompletionContext): Promiseable<vscode.CompletionItem[] | vscode.CompletionList | undefined | null>,
    onCompletionResolve?(item: vscode.CompletionItem): Promiseable<vscode.CompletionItem>,
    onHover?(textDocument: TextDocument, position: vscode.Position): Promiseable<vscode.Hover | undefined | null>,
};

export type PluginHost = {
    getSettings<T>(section: string, scopeUri?: string): Promise<T | undefined>,
    schemaRequestService?(uri: string): Thenable<string>,
    fileSystemProvider: html.FileSystemProvider,
    typescript: typeof import('typescript/lib/tsserverlibrary'),
    tsLs: ts2.LanguageService | undefined,
    getCssLs(lang: string): css.LanguageService | undefined,
    getStylesheet(document: TextDocument): css.Stylesheet | undefined,
};

export function definePlugin<T, K>(_: (host: PluginHost, depends: T) => EmbeddedLanguagePlugin & { data?: K }) {
    return _;
}
