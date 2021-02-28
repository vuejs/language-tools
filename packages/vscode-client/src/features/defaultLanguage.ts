import * as vscode from 'vscode';
import * as path from 'upath';
import * as fs from 'fs';

export async function activate() {

    onConfigUpdated();

    vscode.workspace.onDidChangeConfiguration(onConfigUpdated);

    function onConfigUpdated() {
        const volar = vscode.extensions.getExtension('johnsoncodehk.volar');
        if (!volar) {
            vscode.window.showWarningMessage('Extension [Volar - johnsoncodehk.volar] not found.');
            return;
        }

        const newLang = getConfigStyleDefaultLanguage();
        if (!newLang) return;

        const tsFile = path.join(volar.extensionPath, 'syntaxes', 'vue.tmLanguage.json');
        try {
            const tmText = fs.readFileSync(tsFile, 'utf8');
            let newTmText = tmText;

            const nameStart = newTmText.indexOf('"__DEFAULT_STYLE_NAME_START__"');
            const nameEnd = newTmText.indexOf('"__DEFAULT_STYLE_NAME_END__"');
            if (nameStart >= 0 && nameEnd >= 0) {
                newTmText = newTmText.substr(0, nameStart)
                    + `"__DEFAULT_STYLE_NAME_START__": null,"name": "source.${newLang}.embedded.html",`
                    + newTmText.substr(nameEnd);
            }

            const includeStart = newTmText.indexOf('"__DEFAULT_STYLE_INCLUDE_START__"');
            const includeEnd = newTmText.indexOf('"__DEFAULT_STYLE_INCLUDE_END__"');
            if (includeStart >= 0 && includeEnd >= 0) {
                newTmText = newTmText.substr(0, includeStart)
                    + `"__DEFAULT_STYLE_INCLUDE_START__": null,"include": "source.${newLang}",`
                    + newTmText.substr(includeEnd);
            }

            if (newTmText !== tmText) {
                fs.writeFileSync(tsFile, newTmText, 'utf8');
                showReload(newLang);
            }
        }
        catch (err) {
            vscode.window.showWarningMessage('Volar package.json update failed.');
        }
    }
    async function showReload(lang: string) {
        const reload = await vscode.window.showInformationMessage(`Default <style> language changed to "${lang}", please reload VSCode to take effect.`, 'Reload Window');
        if (reload === undefined) return; // cancel
        vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
    function getConfigStyleDefaultLanguage() {
        return vscode.workspace.getConfiguration('volar').get<string>('style.defaultLanguage');
    }
}
