import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.createWorkspaceSnippets', async () => {
        const templatePath = path.resolve(__dirname, '..', '..', 'templates', 'vue.code-snippets');
        const template = fs.readFileSync(templatePath);
        if (vscode.workspace.workspaceFolders) {
            for (const rootPath of vscode.workspace.workspaceFolders) {
                const templatePath = path.join(rootPath.uri.fsPath, '.vscode', 'vue.code-snippets');
                if (!fs.existsSync(templatePath)) {
                    fs.writeFileSync(templatePath, template);
                }
                const document = await vscode.workspace.openTextDocument(templatePath);
                await vscode.window.showTextDocument(document);
            }
        }
    }));
}
