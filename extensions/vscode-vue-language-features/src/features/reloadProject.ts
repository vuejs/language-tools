import * as vscode from 'vscode';
import * as shared from '@volar/shared';
import type { BaseLanguageClient } from 'vscode-languageclient';

export async function register(cmd: string, context: vscode.ExtensionContext, languageClients: BaseLanguageClient[]) {
	context.subscriptions.push(vscode.commands.registerCommand(cmd, () => {
		if (vscode.window.activeTextEditor) {
			for (const client of languageClients) {
				client.sendNotification(shared.ReloadProjectNotification.type, client.code2ProtocolConverter.asTextDocumentIdentifier(vscode.window.activeTextEditor.document));
			}
		}
	}));
}
