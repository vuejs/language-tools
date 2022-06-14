import * as vscode from 'vscode';
import * as shared from '@volar/shared';
import type { BaseLanguageClient } from 'vscode-languageclient';

export async function register(cmd: string, context: vscode.ExtensionContext, languageClient: BaseLanguageClient) {
	context.subscriptions.push(vscode.commands.registerCommand(cmd, () => {
		languageClient.sendNotification(shared.WriteVirtualFilesNotification.type);
	}));
}
