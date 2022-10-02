import * as vscode from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { ReloadProjectNotification } from '@volar/vue-language-server';

export async function register(cmd: string, context: vscode.ExtensionContext, client: BaseLanguageClient) {
	context.subscriptions.push(vscode.commands.registerCommand(cmd, () => {
		if (vscode.window.activeTextEditor) {
			client.sendNotification(ReloadProjectNotification.type, client.code2ProtocolConverter.asTextDocumentIdentifier(vscode.window.activeTextEditor.document));
		}
	}));
}
