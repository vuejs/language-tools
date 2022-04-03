import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';

type NotNullableResult<T> = T | Thenable<T>;
type NullableResult<T> = NotNullableResult<T | undefined | null>;

var __VLS_currentConfigurationHost: ConfigurationHost | undefined;

export function useConfigurationHost() {
    return __VLS_currentConfigurationHost;
}

export function setCurrentConfigurationHost(configHost: ConfigurationHost | undefined) {
    __VLS_currentConfigurationHost = configHost;
}

export type SemanticToken = [number, number, number, number, number];

export interface ConfigurationHost {
    getConfiguration: (<T> (section: string, scopeUri?: string) => Promise<T | undefined>),
    onDidChangeConfiguration: (cb: () => void) => void,
    rootUris: string[],
}

export interface ExecuteCommandContext {
    token: vscode.CancellationToken;
    workDoneProgress: {
        begin(title: string, percentage?: number, message?: string, cancellable?: boolean): void;
        report(percentage: number): void;
        report(message: string): void;
        report(percentage: number, message: string): void;
        done(): void;
    };
    sendNotification<P>(type: vscode.NotificationType<P>, params: P): Promise<void>;
    applyEdit(paramOrEdit: vscode.ApplyWorkspaceEditParams | vscode.WorkspaceEdit): Promise<vscode.ApplyWorkspaceEditResult>;
}

export type EmbeddedLanguageServicePlugin = {

    triggerCharacters?: string[],

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
    doExecuteCommand?(command: string, args: any[], context: ExecuteCommandContext): NotNullableResult<void>;
    findDocumentColors?(document: TextDocument): NullableResult<vscode.ColorInformation[]>;
    getColorPresentations?(document: TextDocument, color: vscode.Color, range: vscode.Range): NullableResult<vscode.ColorPresentation[]>;
    doRenamePrepare?(document: TextDocument, position: vscode.Position): NullableResult<vscode.Range | vscode.ResponseError<void>>;
    doRename?(document: TextDocument, position: vscode.Position, newName: string): NullableResult<vscode.WorkspaceEdit>;
    doFileRename?(oldUri: string, newUri: string): NullableResult<vscode.WorkspaceEdit>;
    getFoldingRanges?(document: TextDocument): NullableResult<vscode.FoldingRange[]>;
    getSelectionRanges?(document: TextDocument, positions: vscode.Position[]): NullableResult<vscode.SelectionRange[]>;
    getSignatureHelp?(document: TextDocument, position: vscode.Position, context?: vscode.SignatureHelpContext): NullableResult<vscode.SignatureHelp>;
    format?(document: TextDocument, range: vscode.Range, options: vscode.FormattingOptions): NullableResult<vscode.TextEdit[]>;

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
    resolveEmbeddedRange?(range: vscode.Range): vscode.Range | undefined;

    // findMatchingTagPosition?(document: TextDocument, position: vscode.Position, htmlDocument: HTMLDocument): vscode.Position | null;
}
