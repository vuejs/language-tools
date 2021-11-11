import * as vscode from 'vscode';
import * as shared from '@volar/shared';
import type { CommonLanguageClient } from 'vscode-languageclient';

export async function activate(context: vscode.ExtensionContext, languageClient: CommonLanguageClient) {
	await languageClient.onReady();
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.writeTemplateLsVirtualFiles', () => {
		languageClient.sendNotification(shared.WriteVirtualFilesNotification.type, { lsType: 'template' });
	}));
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.writeScriptLsVirtualFiles', () => {
		languageClient.sendNotification(shared.WriteVirtualFilesNotification.type, { lsType: 'script' });
	}));
}
