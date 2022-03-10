import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import { Embedded, EmbeddedDocumentSourceMap } from '@volar/vue-typescript';

type NotNullableResult<T> = T | Thenable<T>;
type NullableResult<T> = T | undefined | null | Thenable<T | undefined | null>;

export type SemanticToken = [number, number, number, number, number];

export type EmbeddedLanguagePlugin = {
    doValidation?(document: TextDocument, options: {
        semantic?: boolean;
        syntactic?: boolean;
        suggestion?: boolean;
        declaration?: boolean;
    }): NullableResult<vscode.Diagnostic[]>;
    doComplete?(document: TextDocument, position: vscode.Position, context?: vscode.CompletionContext): NullableResult<vscode.CompletionList>,
    doCompleteResolve?(item: vscode.CompletionItem, newPosition?: vscode.Position): NotNullableResult<vscode.CompletionItem>,
    doHover?(document: TextDocument, position: vscode.Position): NullableResult<vscode.Hover>,
    findDefinition?(document: TextDocument, position: vscode.Position): NullableResult<vscode.LocationLink[]>;
    findTypeDefinition?(document: TextDocument, position: vscode.Position): NullableResult<vscode.LocationLink[]>;
    findImplementations?(document: TextDocument, position: vscode.Position): NullableResult<vscode.LocationLink[]>;
    findReferences?(document: TextDocument, position: vscode.Position): NullableResult<vscode.Location[]>;
    findDocumentHighlights?(document: TextDocument, position: vscode.Position): NullableResult<vscode.DocumentHighlight[]>;
    findDocumentLinks?(document: TextDocument): NullableResult<vscode.DocumentLink[]>;
    findDocumentSymbols?(document: TextDocument): NullableResult<vscode.SymbolInformation[]>;
    findDocumentSemanticTokens?(document: TextDocument, range?: vscode.Range, cancleToken?: vscode.CancellationToken): NullableResult<SemanticToken[]>;
    findWorkspaceSymbols?(query: string): NullableResult<vscode.SymbolInformation[]>;
    doCodeActions?(document: TextDocument, range: vscode.Range, context: vscode.CodeActionContext): NullableResult<vscode.CodeAction[]>;
    doCodeActionResolve?(codeAction: vscode.CodeAction): NotNullableResult<vscode.CodeAction>;
    doCodeLens?(document: TextDocument): NullableResult<vscode.CodeLens[]>;
    doCodeLensResolve?(codeLens: vscode.CodeLens): NotNullableResult<vscode.CodeLens>;
    findDocumentColors?(document: TextDocument): NullableResult<vscode.ColorInformation[]>;
    getColorPresentations?(document: TextDocument, color: vscode.Color, range: vscode.Range): NullableResult<vscode.ColorPresentation[]>;
    doRenamePrepare?(document: TextDocument, position: vscode.Position): NullableResult<vscode.Range | vscode.ResponseError<void>>;
    doRename?(document: TextDocument, position: vscode.Position, newName: string): NullableResult<vscode.WorkspaceEdit>;
    doFileRename?(oldUri: string, newUri: string): NullableResult<vscode.WorkspaceEdit>;
    getFoldingRanges?(document: TextDocument): NullableResult<vscode.FoldingRange[]>;
    getSelectionRanges?(document: TextDocument, positions: vscode.Position[]): NullableResult<vscode.SelectionRange[]>;
    getSignatureHelp?(document: TextDocument, position: vscode.Position, context?: vscode.SignatureHelpContext): NullableResult<vscode.SignatureHelp>;
    format?(document: TextDocument, range: vscode.Range | undefined, options: vscode.FormattingOptions): NullableResult<vscode.TextEdit[]>;

    callHierarchy?: {
        doPrepare(document: TextDocument, position: vscode.Position): NullableResult<vscode.CallHierarchyItem[]>;
        getIncomingCalls(item: vscode.CallHierarchyItem): NotNullableResult<vscode.CallHierarchyIncomingCall[]>;
        getOutgoingCalls(item: vscode.CallHierarchyItem): NotNullableResult<vscode.CallHierarchyOutgoingCall[]>;
    },

    // html
    findLinkedEditingRanges?(document: TextDocument, position: vscode.Position): NullableResult<vscode.LinkedEditingRanges>;
    doAutoInsert?(document: TextDocument, position: vscode.Position, context: {
        lastChange: {
            range: vscode.Range;
            rangeOffset: number;
            rangeLength: number;
            text: string;
        },
    }): NullableResult<string | vscode.TextEdit>;

    /**
     * TODO: only support to doCompleteResolve for now
     */
    resolveEmbeddedRange?(range: vscode.Range, sourceMap: EmbeddedDocumentSourceMap): vscode.Range | undefined;

    // findMatchingTagPosition?(document: TextDocument, position: vscode.Position, htmlDocument: HTMLDocument): vscode.Position | null;
};

export function definePlugin<T>(_: (host: T) => EmbeddedLanguagePlugin) {
    return _;
}

export async function visitEmbedded(embeddeds: Embedded[], cb: (sourceMap: EmbeddedDocumentSourceMap) => Promise<boolean>) {
    for (const embedded of embeddeds) {

        if (!await visitEmbedded(embedded.embeddeds, cb)) {
            return false;
        }

        if (embedded.sourceMap) {
            if (!await cb(embedded.sourceMap)) {
                return false;
            }
        }
    }

    return true;
}
