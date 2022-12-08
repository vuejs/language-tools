import * as vscode from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { WriteVirtualFilesNotification } from '@volar/language-server';

export async function register(cmd: string, context: vscode.ExtensionContext, client: BaseLanguageClient) {
	context.subscriptions.push(vscode.commands.registerCommand(cmd, () => {
		if (vscode.window.activeTextEditor) {
			client.sendNotification(WriteVirtualFilesNotification.type, client.code2ProtocolConverter.asTextDocumentIdentifier(vscode.window.activeTextEditor.document));
		}
	}));
}
