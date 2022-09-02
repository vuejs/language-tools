import * as vscode from 'vscode';
import * as fs from '../utils/fs';

export async function register(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.createWorkspaceSnippets', async () => {
		if (vscode.workspace.workspaceFolders) {
			for (const rootPath of vscode.workspace.workspaceFolders) {

				const volar = vscode.extensions.getExtension('Vue.volar');
				if (!volar) return;

				const templateUri = vscode.Uri.joinPath(volar.extensionUri, 'templates', 'vue.code-snippets');
				const newTemplateUri = vscode.Uri.joinPath(rootPath.uri, '.vscode', 'vue.code-snippets');

				if (!await fs.exists(newTemplateUri)) {
					const template = await vscode.workspace.fs.readFile(templateUri);
					vscode.workspace.fs.writeFile(newTemplateUri, template);
				}

				const document = await vscode.workspace.openTextDocument(newTemplateUri);
				await vscode.window.showTextDocument(document);
			}
		}
	}));
}
