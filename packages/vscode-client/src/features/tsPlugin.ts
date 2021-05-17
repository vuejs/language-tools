import * as vscode from 'vscode';
import * as path from 'upath';
import * as fs from 'fs';
import { userPick } from './splitEditors';

export async function activate(context: vscode.ExtensionContext) {

    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
    statusBar.command = 'volar.action.toggleTsPlugin';
    updateTsPlugin();
    updateTsPluginStatus();

    context.subscriptions.push(vscode.commands.registerCommand('volar.action.toggleTsPlugin', async () => {
        const options = new Map<boolean | number, string>();
        const _isTsPluginEnabled = isTsPluginEnabled();
        options.set(true, (_isTsPluginEnabled === true ? '• ' : '') + 'Enable TS Plugin');
        options.set(false, (_isTsPluginEnabled === false ? '• ' : '') + 'Disable TS Plugin');

        const select = await userPick(options);
        if (select === undefined) return; // cancle

        if (select !== _isTsPluginEnabled) {
            toggleTsPlugin();
        }
    }));
    vscode.workspace.onDidChangeConfiguration(updateTsPlugin);
    vscode.workspace.onDidChangeConfiguration(updateTsPluginStatus);

    async function updateTsPlugin() {
        const shouldTsPluginEnabled = getTsPluginConfig();
        const _isTsPluginEnabled = isTsPluginEnabled();
        if (shouldTsPluginEnabled !== null && shouldTsPluginEnabled !== _isTsPluginEnabled) {
            const msg = shouldTsPluginEnabled
                ? `Workspace using TS plugin but it's disabled, do you want to turn it on?`
                : `Workspace unused TS plugin but it's enabled, do you want to turn it off?`;
            const btnText = shouldTsPluginEnabled ? 'Enable TS Plugin' : 'Disable TS Plugin';
            const toggle = await vscode.window.showInformationMessage(msg, btnText);
            if (toggle === btnText) {
                toggleTsPlugin();
            }
        }
    }
    function updateTsPluginStatus() {
        if (getTsPluginStatusConfig()) {
            if (isTsPluginEnabled()) {
                statusBar.text = 'Vue TS Plugin ☑';
            }
            else {
                statusBar.text = 'Vue TS Plugin ☐';
            }
            statusBar.show();
        }
        else {
            statusBar.hide();
        }
    }
    function toggleTsPlugin() {
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
                showReload();
            }
            else if (packageText.indexOf(`"typescriptServerPlugins"`) >= 0) {
                const newText = packageText.replace(`"typescriptServerPlugins"`, `"typescriptServerPlugins-off"`);
                fs.writeFileSync(packageJson, newText, 'utf8');
                showReload();
            }
            else {
                vscode.window.showWarningMessage('Unknow package.json status.');
            }
        }
        catch (err) {
            vscode.window.showWarningMessage('Volar package.json update failed.');
        }
    }
    async function showReload() {
        const reload = await vscode.window.showInformationMessage('Please reload VSCode to restart TS Server.', 'Reload Window');
        if (reload === undefined) return; // cancel
        vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
}

export function isTsPluginEnabled() {
    const volar = vscode.extensions.getExtension('johnsoncodehk.volar');
    if (!volar) {
        return false;
    }

    const packageJson = path.join(volar.extensionPath, 'package.json');
    try {
        const packageText = fs.readFileSync(packageJson, 'utf8');
        if (packageText.indexOf(`"typescriptServerPlugins"`) >= 0) {
            return true;
        }
    } catch { }

    return false;
}
function getTsPluginConfig() {
    return vscode.workspace.getConfiguration('volar').get<boolean | null>('tsPlugin');
}
function getTsPluginStatusConfig() {
    return vscode.workspace.getConfiguration('volar').get<boolean>('tsPluginStatus');
}
