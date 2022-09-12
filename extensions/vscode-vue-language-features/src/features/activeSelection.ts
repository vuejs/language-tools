import * as vscode from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { GetEditorSelectionRequest } from '@volar/vue-language-server';

export async function activate(context: vscode.ExtensionContext, languageClient: BaseLanguageClient) {
	context.subscriptions.push(languageClient.onRequest(GetEditorSelectionRequest.type, () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			return {
				textDocument: {
					uri: languageClient.code2ProtocolConverter.asUri(editor.document.uri),
				},
				position: editor.selection.end,
			};
		}
	}));
}
