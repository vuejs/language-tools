import * as vscode from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { ReportStats } from '@volar/language-server';

export async function register(cmd: string, context: vscode.ExtensionContext, clients: BaseLanguageClient[]) {
	context.subscriptions.push(vscode.commands.registerCommand(cmd, async () => {
		for (const client of clients) {
			await client.sendNotification(ReportStats.type);
		}
		await vscode.commands.executeCommand('workbench.action.output.toggleOutput');
	}));
}
