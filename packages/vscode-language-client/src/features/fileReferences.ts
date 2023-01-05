import * as vscode from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import * as nls from 'vscode-nls';
import { FindFileReferenceRequest } from '@volar/language-server';

const localize = nls.loadMessageBundle();

export async function register(cmd: string, context: vscode.ExtensionContext, client: BaseLanguageClient) {
	context.subscriptions.push(vscode.commands.registerCommand(cmd, async (uri?: vscode.Uri) => {

		// https://github.com/microsoft/vscode/blob/main/extensions/typescript-language-features/src/languageFeatures/fileReferences.ts
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: localize('progress.title', "Finding file references")
		}, async (_progress) => {

      			if (!uri) {
      			  const editor = vscode.window.activeTextEditor;
      			  if (!editor) return;

      			  uri = editor.document.uri;
      			}

			const response = await client.sendRequest(FindFileReferenceRequest.type, { textDocument: { uri: uri.toString() } });
			if (!response) {
				return;
			}

			const locations = response.map(loc => client.protocol2CodeConverter.asLocation(loc));
			const config = vscode.workspace.getConfiguration('references');
			const existingSetting = config.inspect<string>('preferredLocation');

			await config.update('preferredLocation', 'view');
			try {
				await vscode.commands.executeCommand('editor.action.showReferences', uri, new vscode.Position(0, 0), locations);
			} finally {
				await config.update('preferredLocation', existingSetting?.workspaceFolderValue ?? existingSetting?.workspaceValue);
			}
		});
	}));
}
