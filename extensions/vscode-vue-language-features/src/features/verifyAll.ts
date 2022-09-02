import * as vscode from 'vscode';
import * as shared from '@volar/shared';
import type { BaseLanguageClient } from 'vscode-languageclient';

export async function register(context: vscode.ExtensionContext, languageClient: BaseLanguageClient) {
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.verifyAllScripts', () => {
		languageClient.sendNotification(shared.VerifyAllScriptsNotification.type);
	}));
}
