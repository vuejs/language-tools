import * as vscode from 'vscode';
import { BaseLanguageClient, State } from 'vscode-languageclient';

export async function register(_context: vscode.ExtensionContext, client: BaseLanguageClient) {

	await client.start();

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	statusBar.text = "Restart Volar Server";
	statusBar.command = "volar.action.restartServer";

	function update(e: vscode.TextEditor | undefined) {
		if (!e) return;
		const currentLangId = e.document.languageId;
		if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'vue'].includes(currentLangId)) {
			statusBar.show();
		} else {
			statusBar.hide();
		}
	}

	update(vscode.window.activeTextEditor);
	const dispose = vscode.window.onDidChangeActiveTextEditor(update);

	client.onDidChangeState(e => {
		if (e.newState === State.Stopped) {
			dispose.dispose();
			statusBar.dispose();
		}
	});
}
