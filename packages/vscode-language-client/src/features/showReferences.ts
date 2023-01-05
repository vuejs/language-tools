import * as vscode from 'vscode';
import { BaseLanguageClient, State } from 'vscode-languageclient';
import { ShowReferencesNotification } from '@volar/language-server';

export async function register(context: vscode.ExtensionContext, client: BaseLanguageClient) {

	addHandle();

	client.onDidChangeState(() => {
		if (client.state === State.Running) {
			addHandle();
		}
	});

	function addHandle() {
		context.subscriptions.push(client.onNotification(ShowReferencesNotification.type, params => {
			const uri = params.textDocument.uri;
			const pos = params.position;
			const refs = params.references;
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
}
