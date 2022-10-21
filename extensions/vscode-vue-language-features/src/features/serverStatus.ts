import * as vscode from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { ReportStats } from '@volar/vue-language-server';

export async function register(context: vscode.ExtensionContext, client: BaseLanguageClient) {
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.serverStats', async () => {
		await client.sendNotification(ReportStats.type);
		await vscode.commands.executeCommand('workbench.action.output.toggleOutput');
	}));
}
