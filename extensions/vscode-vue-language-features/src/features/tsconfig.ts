import * as vscode from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import * as path from 'typesafe-path';
import { processHtml, processMd, takeOverModeEnabled } from '../common';
import { GetMatchTsConfigRequest } from '@volar/vue-language-server';

export async function register(cmd: string, context: vscode.ExtensionContext, languageClient: BaseLanguageClient) {

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	let currentTsconfig = '';

	updateStatusBar();

	vscode.window.onDidChangeActiveTextEditor(updateStatusBar, undefined, context.subscriptions);
	vscode.commands.registerCommand(cmd, async () => {
		const document = await vscode.workspace.openTextDocument(currentTsconfig);
		await vscode.window.showTextDocument(document);
	});

	async function updateStatusBar() {
		if (
			vscode.window.activeTextEditor?.document.languageId !== 'vue'
			&& !(processMd() && vscode.window.activeTextEditor?.document.languageId === 'markdown')
			&& !(processHtml() && vscode.window.activeTextEditor?.document.languageId === 'html')
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
				GetMatchTsConfigRequest.type,
				languageClient.code2ProtocolConverter.asTextDocumentIdentifier(vscode.window.activeTextEditor.document),
			);
			if (tsconfig?.fileName) {
				statusBar.text = path.relative(vscode.workspace.rootPath! as path.OsPath, tsconfig.fileName as path.PosixPath);
				statusBar.command = cmd;
				currentTsconfig = tsconfig.fileName;
			}
			else {
				statusBar.text = 'No tsconfig';
				statusBar.command = undefined;
			}
			statusBar.show();
		}
	}
}
