import * as vscode from 'vscode';
import { DocumentVersionRequest } from '@volar/shared';
import type { LanguageClient } from 'vscode-languageclient/node';

export async function activate(context: vscode.ExtensionContext, languageClient: LanguageClient) {
	await languageClient.onReady();
	context.subscriptions.push(languageClient.onRequest(DocumentVersionRequest.type, handler => {
		const doc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === handler.uri);
		return doc?.version;
	}));
}
