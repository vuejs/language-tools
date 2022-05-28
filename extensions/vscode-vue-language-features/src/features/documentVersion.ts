import * as vscode from 'vscode';
import * as shared from '@volar/shared';
import type { BaseLanguageClient } from 'vscode-languageclient';

export async function activate(context: vscode.ExtensionContext, languageClient: BaseLanguageClient) {
	context.subscriptions.push(languageClient.onRequest(shared.GetDocumentVersionRequest.type, handler => {
		const doc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === handler.uri);
		return doc?.version;
	}));
}
