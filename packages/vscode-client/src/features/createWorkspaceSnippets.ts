import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.createWorkspaceSnippets', async () => {
        if (vscode.workspace.workspaceFolders) {
            for (const rootPath of vscode.workspace.workspaceFolders) {

                const volar = vscode.extensions.getExtension('johnsoncodehk.volar');
                if (!volar) return;

                const templatePath = path.join(volar.extensionPath, 'templates', 'vue.code-snippets');
                const newTemplatePath = path.join(rootPath.uri.fsPath, '.vscode', 'vue.code-snippets');

                if (!fs.existsSync(newTemplatePath)) {
                    const template = fs.readFileSync(templatePath);
                    fs.writeFileSync(newTemplatePath, template);
                }
                const document = await vscode.workspace.openTextDocument(templatePath);
                await vscode.window.showTextDocument(document);
            }
        }
    }));
}
