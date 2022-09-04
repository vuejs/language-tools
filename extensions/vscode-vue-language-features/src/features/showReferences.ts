import * as vscode from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { ShowReferencesNotification } from '@volar/vue-language-server';

export async function activate(context: vscode.ExtensionContext, languageClient: BaseLanguageClient) {
	context.subscriptions.push(languageClient.onNotification(ShowReferencesNotification.type, handler => {
		const uri = handler.textDocument.uri;
		const pos = handler.position;
		const refs = handler.references;
		vscode.commands.executeCommand(
			'editor.action.showReferences',
			vscode.Uri.parse(uri),
			new vscode.Position(pos.line, pos.character),
			refs.map(ref => new vscode.Location(
				vscode.Uri.parse(ref.uri),
				new vscode.Range(ref.range.start.line, ref.range.start.character, ref.range.end.line, ref.range.end.character),
			)),
		);
	}));
}
