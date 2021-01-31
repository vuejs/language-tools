import * as vscode from 'vscode';
import { FormatAllScriptsRequest } from '@volar/shared';
import type { LanguageClient } from 'vscode-languageclient/node';

export async function activate(context: vscode.ExtensionContext, languageClient: LanguageClient) {
    await languageClient.onReady();
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.formatAllScripts', async () => {
        const useTabsOptions = new Map<boolean, string>();
        useTabsOptions.set(true, 'Indent Using Tabs');
        useTabsOptions.set(false, 'Indent Using Spaces');
        const useTabs = await userPick(useTabsOptions);
        if (useTabs === undefined) return; // cancle

        const tabSizeOptions = new Map<number, string>();
        for (let i = 1; i <= 8; i++) {
            tabSizeOptions.set(i, i.toString());
        }
        const tabSize = await userPick(tabSizeOptions, 'Select Tab Size');
        if (tabSize === undefined) return; // cancle

        languageClient.sendRequest(FormatAllScriptsRequest.type, {
            insertSpaces: !useTabs,
            tabSize,
        });

        function userPick<K>(options: Map<K, string>, placeholder?: string) {
            return new Promise<K | undefined>(resolve => {
                const quickPick = vscode.window.createQuickPick();
                quickPick.items = [...options.values()].map(option => ({ label: option }));
                quickPick.placeholder = placeholder;
                quickPick.onDidChangeSelection(selection => {
                    if (selection[0]) {
                        for (const [key, label] of options) {
                            if (selection[0].label === label) {
                                resolve(key);
                                quickPick.hide();
                            }
                        }
                    }
                });
                quickPick.onDidHide(() => {
                    quickPick.dispose();
                    resolve(undefined);
                })
                quickPick.show();
            });
        }
    }));
}
