import * as vscode from 'vscode';
import * as path from 'upath';
import { EmitDtsRequest, uriToFsPath } from '@volar/shared';
import type { LanguageClient } from 'vscode-languageclient/node';
import { userPick } from './formatAll';

export async function activate(context: vscode.ExtensionContext, languageClient: LanguageClient) {
    await languageClient.onReady();
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.emitDts', async () => {

        const options = new Map<any, string>();
        options.set({
            uri: undefined,
            dir: undefined,
            all: true,
        }, 'Emit **/*.vue.d.ts');

        if (vscode.window.activeTextEditor?.document.uri.scheme === 'file') {

            const uri = vscode.window.activeTextEditor.document.uri.toString();
            const fsPath = uriToFsPath(uri);

            if (vscode.window.activeTextEditor.document.languageId === 'vue') {
                const fileName = path.basename(fsPath);
                options.set({
                    uri: uri,
                    dir: undefined,
                    all: false,
                }, `Emit ${fileName}.d.ts`);
            }

            if (vscode.workspace.rootPath) {
                const dir = path.dirname(path.relative(vscode.workspace.rootPath, fsPath));
                options.set({
                    uri: undefined,
                    dir: uri,
                    all: false,
                }, `Emit ${dir}/*.vue.d.ts`);
            }
        }

        const select = await userPick(options);
        if (!select) return;

        languageClient.sendRequest(EmitDtsRequest.type, select);
    }));
}
