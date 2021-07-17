import * as vscode from 'vscode';
import { RestartServerNotification } from '@volar/shared';
import type { LanguageClient } from 'vscode-languageclient/node';

export async function activate(context: vscode.ExtensionContext, languageClients: LanguageClient[]) {
	for (const languageClient of languageClients) {
		await languageClient.onReady();
	}

	context.subscriptions.push(vscode.commands.registerCommand('volar.action.restartServer', () => {
		for (const languageClient of languageClients) {
			languageClient.sendNotification(RestartServerNotification.type, undefined);
		}
	}));
}
