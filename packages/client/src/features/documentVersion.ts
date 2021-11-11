import * as vscode from 'vscode';
import * as shared from '@volar/shared';
import type { CommonLanguageClient } from 'vscode-languageclient';

export async function activate(context: vscode.ExtensionContext, languageClient: CommonLanguageClient) {
	await languageClient.onReady();
	context.subscriptions.push(languageClient.onRequest(shared.GetDocumentVersionRequest.type, handler => {
		const doc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === handler.uri);
		return doc?.version;
	}));
}
