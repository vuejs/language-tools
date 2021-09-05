import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export async function activate(context: vscode.ExtensionContext) {

	if (!vscode.workspace.getConfiguration('volar').get<boolean>('checkVueTscVersion'))
		return;

	if (vscode.workspace.workspaceFolders) {
		for (const folder of vscode.workspace.workspaceFolders) {
			const depPath = path.join(folder.uri.fsPath, 'node_modules', 'vscode-vue-languageservice', 'package.json');
			if (fs.existsSync(depPath)) {
				try {
					const packageJsonText = fs.readFileSync(depPath, 'utf8');
					const packageJson = JSON.parse(packageJsonText);
					const depVersion = packageJson.version;
					if (depVersion && depVersion !== context.extension.packageJSON.version) {

						const message = `vue-tsc dependency version (${depVersion}) is different to Extension version (${context.extension.packageJSON.version}). Type-checking behavior maybe different.`;
						const howTo = 'How To Update?';
						const disable = 'Disable Version Checking';
						const option = await vscode.window.showInformationMessage(message, howTo, disable);

						if (option === howTo) {
							vscode.env.openExternal(vscode.Uri.parse('https://github.com/johnsoncodehk/volar/discussions/402'));
						}
						if (option === disable) {
							vscode.commands.executeCommand('workbench.action.openSettings', 'volar.checkVueTscVersion');
						}
					}
				} catch { }
			}
		}
	}
}
