import * as vscode from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { VerifyAllScriptsNotification } from '@volar/vue-language-server';

export async function register(context: vscode.ExtensionContext, languageClient: BaseLanguageClient) {
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.verifyAllScripts', () => {
		if (vscode.window.activeTextEditor) {
			languageClient.sendNotification(VerifyAllScriptsNotification.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(vscode.window.activeTextEditor.document));
		}
	}));
}
