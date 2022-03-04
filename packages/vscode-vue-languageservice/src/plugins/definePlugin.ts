import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import { Embedded, EmbeddedDocumentSourceMap } from '@volar/vue-typescript';

type Promiseable<T> = T | Promise<T>;

export type EmbeddedLanguagePlugin = {
    isAdditionalCompletion?: boolean,
    triggerCharacters?: string[],
    onCompletion?(textDocument: TextDocument, position: vscode.Position, context?: vscode.CompletionContext): Promiseable<vscode.CompletionList | undefined | null>,
    onCompletionResolve?(item: vscode.CompletionItem): Promiseable<vscode.CompletionItem>,
    onHover?(textDocument: TextDocument, position: vscode.Position): Promiseable<vscode.Hover | undefined | null>,
};

export function definePlugin<T>(_: (host: T) => EmbeddedLanguagePlugin) {
    return _;
}

export async function visitEmbedded(embeddeds: Embedded[], cb: (sourceMap: EmbeddedDocumentSourceMap) => Promise<void>) {
    for (const embedded of embeddeds) {

        await visitEmbedded(embedded.embeddeds, cb);

        if (embedded.sourceMap) {
            await cb(embedded.sourceMap);
        }
    }
}
