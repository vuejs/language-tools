import * as vscode from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import { GetMatchTsConfigRequest } from '@volar/language-server';
import * as path from 'typesafe-path';

export async function register(
	cmd: string,
	context: vscode.ExtensionContext,
	client: BaseLanguageClient,
	shouldStatusBarShow: (document: vscode.TextDocument) => boolean,
) {

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	let currentTsconfigUri: vscode.Uri | undefined;

	updateStatusBar();

	vscode.window.onDidChangeActiveTextEditor(updateStatusBar, undefined, context.subscriptions);

	context.subscriptions.push(vscode.commands.registerCommand(cmd, async () => {
		if (currentTsconfigUri) {
			const document = await vscode.workspace.openTextDocument(currentTsconfigUri);
			await vscode.window.showTextDocument(document);
		}
	}));

	async function updateStatusBar() {
		if (
			!vscode.window.activeTextEditor
			|| !shouldStatusBarShow(vscode.window.activeTextEditor.document)
		) {
			statusBar.hide();
		}
		else {
			const tsconfig = await client.sendRequest(
				GetMatchTsConfigRequest.type,
				client.code2ProtocolConverter.asTextDocumentIdentifier(vscode.window.activeTextEditor.document),
			);
			if (tsconfig?.uri) {
				currentTsconfigUri = vscode.Uri.parse(tsconfig.uri);
				statusBar.text = path.relative(
					(vscode.workspace.rootPath || '/') as path.OsPath,
					currentTsconfigUri.fsPath as path.OsPath,
				);
				statusBar.command = cmd;
			}
			else {
				statusBar.text = 'No tsconfig';
				statusBar.command = undefined;
			}
			statusBar.show();
		}
	}
}
