import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import * as shared from '@volar/shared';
import * as path from 'upath';

export async function activate(context: vscode.ExtensionContext, languageClient: LanguageClient) {

	await languageClient.onReady();
	await languageClient.sendRequest(shared.InitDoneRequest.type);

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);

	updateStatusBar();
	vscode.window.onDidChangeActiveTextEditor(updateStatusBar, undefined, context.subscriptions);

	async function updateStatusBar() {
		if (vscode.window.activeTextEditor?.document.languageId !== 'vue') {
			statusBar.hide();
		}
		else {
			const tsconfig = await languageClient.sendRequest(
				shared.GetMatchTsConfigRequest.type,
				languageClient.code2ProtocolConverter.asTextDocumentIdentifier(vscode.window.activeTextEditor.document),
			);
			if (tsconfig) {
				statusBar.text = path.relative(vscode.workspace.rootPath!, tsconfig);
			}
			else {
				statusBar.text = 'No tsconfig';
			}
			statusBar.show();
		}
	}
}
