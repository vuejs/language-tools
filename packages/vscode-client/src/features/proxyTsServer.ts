import * as vscode from 'vscode';
import * as path from 'upath';
import * as fs from 'fs';

export async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.proxyTsServer', () => {

        const volar = vscode.extensions.getExtension('johnsoncodehk.volar');
        if (!volar) {
            vscode.window.showWarningMessage('Extension [Volar - johnsoncodehk.volar] not found.');
            return;
        }

        const packageJson = path.join(volar.extensionPath, 'package.json');
        try {
            const packageText = fs.readFileSync(packageJson, 'utf8');
            if (packageText.indexOf(`"typescriptServerPlugins-off"`) >= 0) {
                const newText = packageText.replace(`"typescriptServerPlugins-off"`, `"typescriptServerPlugins"`);
                fs.writeFileSync(packageJson, newText, 'utf8');
                vscode.window.showInformationMessage('TS Plugin enabled, please reload vscode to take effect.');
            }
            else if (packageText.indexOf(`"typescriptServerPlugins"`) >= 0) {
                const newText = packageText.replace(`"typescriptServerPlugins"`, `"typescriptServerPlugins-off"`);
                fs.writeFileSync(packageJson, newText, 'utf8');
                vscode.window.showInformationMessage('TS Plugin disabled, please reload vscode to take effect.');
            }
            else {
                vscode.window.showWarningMessage('Unknow package.json status.');
            }
        }
        catch (err) {
            vscode.window.showWarningMessage('Volar package.json update failed.');
        }
    }));
}
