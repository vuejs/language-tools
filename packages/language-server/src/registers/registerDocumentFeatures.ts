import * as vscode from 'vscode-languageserver';
import { ServerInitializationOptions } from '../types';

export function register(
	features: NonNullable<ServerInitializationOptions['documentFeatures']>,
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
		// https://github.com/microsoft/vscode/blob/ce119308e8fd4cd3f992d42b297588e7abe33a0c/extensions/typescript-language-features/src/languageFeatures/formatting.ts#L99
		server.documentOnTypeFormattingProvider = {
			firstTriggerCharacter: ';',
			moreTriggerCharacter: ['}', '\n'],
		};
	}
}
