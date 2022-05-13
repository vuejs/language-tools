import * as vscode from 'vscode';
import { CommonLanguageClient } from 'vscode-languageclient';
import * as shared from '@volar/shared';
import * as path from 'path';
import { takeOverModeEnabled } from '../common';

export async function activate(context: vscode.ExtensionContext, languageClient: CommonLanguageClient) {

	await languageClient.onReady();

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	let currentTsconfig = '';

	updateStatusBar();

	vscode.window.onDidChangeActiveTextEditor(updateStatusBar, undefined, context.subscriptions);
	vscode.commands.registerCommand('volar.openTsconfig', async () => {
		const document = await vscode.workspace.openTextDocument(currentTsconfig);
		await vscode.window.showTextDocument(document);
	});

	async function updateStatusBar() {
		if (
			vscode.window.activeTextEditor?.document.languageId !== 'vue'
			&& !(
				takeOverModeEnabled()
				&& vscode.window.activeTextEditor
				&& ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(vscode.window.activeTextEditor.document.languageId)
			)
		) {
			statusBar.hide();
		}
		else {
			const tsconfig = await languageClient.sendRequest(
				shared.GetMatchTsConfigRequest.type,
				languageClient.code2ProtocolConverter.asTextDocumentIdentifier(vscode.window.activeTextEditor.document),
			);
			if (tsconfig) {
				statusBar.text = path.relative(vscode.workspace.rootPath!, tsconfig);
				statusBar.command = 'volar.openTsconfig';
				currentTsconfig = tsconfig;
			}
			else {
				statusBar.text = 'No tsconfig';
				statusBar.command = undefined;
			}
			statusBar.show();
		}
	}
}
