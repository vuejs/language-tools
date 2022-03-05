import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import { Embedded, EmbeddedDocumentSourceMap } from '@volar/vue-typescript';

type WithPromise<T> = T | Promise<T>;

export type EmbeddedLanguagePlugin = {
    isAdditionalCompletion?: boolean,
    triggerCharacters?: string[],
    onCompletion?(textDocument: TextDocument, position: vscode.Position, context?: vscode.CompletionContext): WithPromise<vscode.CompletionList | undefined | null>,
    onCompletionResolve?(item: vscode.CompletionItem, newPosition?: vscode.Position): WithPromise<vscode.CompletionItem>,
    onHover?(textDocument: TextDocument, position: vscode.Position): WithPromise<vscode.Hover | undefined | null>,
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
