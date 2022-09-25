import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { LanguageServicePluginContext } from './types';

export type NotNullableResult<T> = T | Thenable<T>;
export type NullableResult<T> = NotNullableResult<T | undefined | null>;

export type SemanticToken = [number, number, number, number, number];

export interface ExecuteCommandContext {
	token: vscode.CancellationToken;
	workDoneProgress: {
		begin(title: string, percentage?: number, message?: string, cancellable?: boolean): void;
		report(percentage: number): void;
		report(message: string): void;
		report(percentage: number, message: string): void;
		done(): void;
	};
	showReferences(params: {
		textDocument: vscode.TextDocumentIdentifier,
		position: vscode.Position,
		references: vscode.Location[],
	}): Promise<void>;
	applyEdit(paramOrEdit: vscode.ApplyWorkspaceEditParams | vscode.WorkspaceEdit): Promise<vscode.ApplyWorkspaceEditResult>;
}

export interface EmbeddedLanguageServicePlugin {

	setup?(context: LanguageServicePluginContext): void;

	validation?: {
		onFull?(document: TextDocument): NullableResult<vscode.Diagnostic[]>;
		onSemantic?(document: TextDocument): NullableResult<vscode.Diagnostic[]>;
		onSyntactic?(document: TextDocument): NullableResult<vscode.Diagnostic[]>;
		onSuggestion?(document: TextDocument): NullableResult<vscode.Diagnostic[]>;
		onDeclaration?(document: TextDocument): NullableResult<vscode.Diagnostic[]>;
	},
	doHover?(document: TextDocument, position: vscode.Position): NullableResult<vscode.Hover>,
	findImplementations?(document: TextDocument, position: vscode.Position): NullableResult<vscode.LocationLink[]>;
	findReferences?(document: TextDocument, position: vscode.Position): NullableResult<vscode.Location[]>;
	findFileReferences?(document: TextDocument): NullableResult<vscode.Location[]>;
	findDocumentHighlights?(document: TextDocument, position: vscode.Position): NullableResult<vscode.DocumentHighlight[]>;
	findDocumentLinks?(document: TextDocument): NullableResult<vscode.DocumentLink[]>;
	findDocumentSymbols?(document: TextDocument): NullableResult<vscode.SymbolInformation[]>;
	findDocumentSemanticTokens?(document: TextDocument, range?: vscode.Range, cancleToken?: vscode.CancellationToken): NullableResult<SemanticToken[]>;
	findWorkspaceSymbols?(query: string): NullableResult<vscode.SymbolInformation[]>;
	doExecuteCommand?(command: string, args: any[], context: ExecuteCommandContext): NotNullableResult<void>;
	findDocumentColors?(document: TextDocument): NullableResult<vscode.ColorInformation[]>;
	getColorPresentations?(document: TextDocument, color: vscode.Color, range: vscode.Range): NullableResult<vscode.ColorPresentation[]>;
	doFileRename?(oldUri: string, newUri: string): NullableResult<vscode.WorkspaceEdit>;
	getFoldingRanges?(document: TextDocument): NullableResult<vscode.FoldingRange[]>;
	getSelectionRanges?(document: TextDocument, positions: vscode.Position[]): NullableResult<vscode.SelectionRange[]>;
	getSignatureHelp?(document: TextDocument, position: vscode.Position, context?: vscode.SignatureHelpContext): NullableResult<vscode.SignatureHelp>;
	format?(document: TextDocument, range: vscode.Range, options: vscode.FormattingOptions): NullableResult<vscode.TextEdit[]>;
	formatOnType?(document: TextDocument, position: vscode.Position, key: string, options: vscode.FormattingOptions): NullableResult<vscode.TextEdit[]>;

	definition?: {
		on?(document: TextDocument, position: vscode.Position): NullableResult<vscode.LocationLink[]>;
		onType?(document: TextDocument, position: vscode.Position): NullableResult<vscode.LocationLink[]>;
	},

	complete?: {
		triggerCharacters?: string[],
		isAdditional?: boolean,
		on?(document: TextDocument, position: vscode.Position, context?: vscode.CompletionContext): NullableResult<vscode.CompletionList>,
		resolve?(item: vscode.CompletionItem, newPosition?: vscode.Position): NotNullableResult<vscode.CompletionItem>,
	},

	rename?: {
		prepare?(document: TextDocument, position: vscode.Position): NullableResult<vscode.Range | vscode.ResponseError<void>>;
		on?(document: TextDocument, position: vscode.Position, newName: string): NullableResult<vscode.WorkspaceEdit>;
	},

	codeAction?: {
		on?(document: TextDocument, range: vscode.Range, context: vscode.CodeActionContext): NullableResult<vscode.CodeAction[]>;
		resolve?(codeAction: vscode.CodeAction): NotNullableResult<vscode.CodeAction>;
	},

	codeLens?: {
		on?(document: TextDocument): NullableResult<vscode.CodeLens[]>;
		resolve?(codeLens: vscode.CodeLens): NotNullableResult<vscode.CodeLens>;
	},

	callHierarchy?: {
		prepare(document: TextDocument, position: vscode.Position): NullableResult<vscode.CallHierarchyItem[]>;
		onIncomingCalls(item: vscode.CallHierarchyItem): NotNullableResult<vscode.CallHierarchyIncomingCall[]>;
		onOutgoingCalls(item: vscode.CallHierarchyItem): NotNullableResult<vscode.CallHierarchyOutgoingCall[]>;
	},

	inlayHints?: {
		on?(document: TextDocument, range: vscode.Range): NullableResult<vscode.InlayHint[]>,
		// TODO: resolve
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
};
