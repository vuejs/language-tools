import * as vscode from 'vscode';
import * as shared from '@volar/shared';
import type { LanguageClient } from 'vscode-languageclient/node';

export async function activate(context: vscode.ExtensionContext, languageClient: LanguageClient) {
	await languageClient.onReady();
	context.subscriptions.push(languageClient.onRequest(shared.ActiveSelectionRequest.type, () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			return {
				uri: languageClient.code2ProtocolConverter.asUri(editor.document.uri),
				offset: editor.document.offsetAt(editor.selection.end),
			};
		}
	}));
}
