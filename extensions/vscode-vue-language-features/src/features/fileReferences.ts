import * as vscode from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import * as shared from '@volar/shared';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export async function register(context: vscode.ExtensionContext, client: BaseLanguageClient) {
	vscode.commands.registerCommand('vue.findAllFileReferences', async (uri?: vscode.Uri) => {

		// https://github.com/microsoft/vscode/blob/main/extensions/typescript-language-features/src/languageFeatures/fileReferences.ts
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: localize('progress.title', "Finding file references")
		}, async (_progress, token) => {

      			if (!uri) {
      			  const editor = vscode.window.activeTextEditor;
      			  if (!editor) return;

      			  uri = editor.document.uri;
      			}

			const response = await client.sendRequest(shared.FindFileReferenceRequest.type, { textDocument: { uri: uri.toString() } });
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
	});
}
