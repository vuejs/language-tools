import * as shared from '@volar/shared';
import * as vscode from 'vscode-languageserver';
import { vueDocReg } from '../features/shared';

export function register(
	connection: vscode.Connection,
	features: NonNullable<shared.ServerInitializationOptions['htmlFeatures']>,
) {
	if (features.foldingRange) {
		connection.client.register(vscode.FoldingRangeRequest.type, vueDocReg);
	}
	if (features.linkedEditingRange) {
		connection.client.register(vscode.LinkedEditingRangeRequest.type, vueDocReg);
	}
	if (features.documentFormatting) {
		connection.client.register(vscode.DocumentFormattingRequest.type, vueDocReg);
	}
}
