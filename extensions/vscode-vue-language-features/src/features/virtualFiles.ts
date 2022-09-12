import * as vscode from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { WriteVirtualFilesNotification } from '@volar/vue-language-server';

export async function register(cmd: string, context: vscode.ExtensionContext, languageClient: BaseLanguageClient) {
	context.subscriptions.push(vscode.commands.registerCommand(cmd, () => {
		if (vscode.window.activeTextEditor) {
			languageClient.sendNotification(WriteVirtualFilesNotification.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(vscode.window.activeTextEditor.document));
		}
	}));
}
