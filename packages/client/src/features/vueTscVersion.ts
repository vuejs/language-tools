import * as vscode from 'vscode';
import * as path from 'path';

export async function activate(context: vscode.ExtensionContext) {

	if (!vscode.workspace.getConfiguration('volar').get<boolean>('checkVueTscVersion'))
		return;

	if (vscode.workspace.workspaceFolders) {
		for (const folder of vscode.workspace.workspaceFolders) {
			try {
				const vueTscPath = require.resolve('vue-tsc/package.json', { paths: [folder.uri.fsPath] });
				const vueTscVueLsPath = require.resolve('vscode-vue-languageservice/package.json', { paths: [path.dirname(vueTscPath)] });
				const vueTscVueLsVersion = require(vueTscVueLsPath).version;
				if (vueTscVueLsVersion !== context.extension.packageJSON.version) {

					const message = `vue-tsc's dependency version (${vueTscVueLsVersion}) is different to Extension version (${context.extension.packageJSON.version}). Type-checking behavior maybe different.`;
					const howTo = 'How To Update?';
					const open = 'Open package.json';
					const disable = 'Disable Checking';
					const option = await vscode.window.showInformationMessage(message, howTo, open, disable);

					if (option === howTo) {
						vscode.env.openExternal(vscode.Uri.parse('https://github.com/johnsoncodehk/volar/discussions/402'));
					}
					if (option === open) {
						vscode.workspace.openTextDocument(vueTscVueLsPath).then(vscode.window.showTextDocument);
					}
					if (option === disable) {
						vscode.commands.executeCommand('workbench.action.openSettings', 'volar.checkVueTscVersion');
					}
				}
			} catch { }
		}
	}
}
