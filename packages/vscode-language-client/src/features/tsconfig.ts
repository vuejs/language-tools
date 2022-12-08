import * as vscode from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import * as path from 'typesafe-path';
import { GetMatchTsConfigRequest } from '@volar/language-server';

export async function register(
	cmd: string,
	context: vscode.ExtensionContext,
	client: BaseLanguageClient,
	shouldStatusBarShow: (document: vscode.TextDocument) => boolean,
) {

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	let currentTsconfig = '';

	updateStatusBar();

	vscode.window.onDidChangeActiveTextEditor(updateStatusBar, undefined, context.subscriptions);
	context.subscriptions.push(vscode.commands.registerCommand(cmd, async () => {
		const document = await vscode.workspace.openTextDocument(currentTsconfig);
		await vscode.window.showTextDocument(document);
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
