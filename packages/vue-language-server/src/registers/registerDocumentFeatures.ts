import * as shared from '@volar/shared';
import * as vscode from 'vscode-languageserver';

export function register(
	features: NonNullable<shared.ServerInitializationOptions['documentFeatures']>,
	server: vscode.ServerCapabilities,
) {
	if (features.selectionRange) {
		server.selectionRangeProvider = true;
	}
	if (features.foldingRange) {
		server.foldingRangeProvider = true;
	}
	if (features.linkedEditingRange) {
		server.linkedEditingRangeProvider = true;
	}
	if (features.documentColor) {
		server.colorProvider = true;
	}
	if (features.documentSymbol) {
		server.documentSymbolProvider = true;
	}
	if (features.documentFormatting) {
		server.documentFormattingProvider = true;
		server.documentRangeFormattingProvider = true;
	}
}
