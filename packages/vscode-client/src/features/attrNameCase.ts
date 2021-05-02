import * as vscode from 'vscode';
import { userPick } from './splitEditors';
import { LanguageClient } from 'vscode-languageclient/node';
import { GetClientAttrNameCaseRequest, GetServerNameCasesRequest, PingRequest, sleep, UriMap } from '@volar/shared';

export async function activate(context: vscode.ExtensionContext, languageClient: LanguageClient) {

    await languageClient.onReady();

    while (typeof (await languageClient.sendRequest(PingRequest.type)) !== 'boolean') {
        await sleep(100);
    }

    languageClient.onRequest(GetClientAttrNameCaseRequest.type, async handler => {
        let attrCase = attrCases.get(handler.uri);
        if (handler.uri.toLowerCase() === vscode.window.activeTextEditor?.document.uri.toString().toLowerCase()) {
            updateStatusBarText(attrCase);
        }
        return attrCase ?? 'kebabCase';
    });

    const attrCases = new UriMap<'kebabCase' | 'pascalCase'>();
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
    statusBar.command = 'volar.action.attrNameCase';

    onChangeDocument(vscode.window.activeTextEditor?.document);
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => {
        onChangeDocument(e?.document);
    }));
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => {
        attrCases.delete(doc.uri.toString());
    }));
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.attrNameCase', async () => {

        const crtDoc = vscode.window.activeTextEditor?.document;
        if (!crtDoc) return;

        const options = new Map<number, string>();

        // attr
        const attrCase = attrCases.get(crtDoc.uri.toString());
        options.set(4, (attrCase === 'kebabCase' ? '• ' : '') + 'Prop Using kebab-case');
        options.set(5, (attrCase === 'pascalCase' ? '• ' : '') + 'Prop Using pascalCase');
        options.set(6, 'Detect Prop name from Content');

        const select = await userPick(options);
        if (select === undefined) return; // cancle

        // attr
        if (select === 4) {
            attrCases.set(crtDoc.uri.toString(), 'kebabCase');
            updateStatusBarText('kebabCase');
        }
        if (select === 5) {
            attrCases.set(crtDoc.uri.toString(), 'pascalCase');
            updateStatusBarText('pascalCase');
        }
        if (select === 6) {
            const detects = await languageClient.sendRequest(GetServerNameCasesRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(crtDoc));
            attrCases.set(crtDoc.uri.toString(), getValidAttrCase(detects.attr));
            updateStatusBarText(getValidAttrCase(detects.attr));
        }
    }));

    async function onChangeDocument(newDoc: vscode.TextDocument | undefined) {
        if (newDoc?.languageId === 'vue') {
            let attrCase = attrCases.get(newDoc.uri.toString());
            if (!attrCase) {
                const attrMode = vscode.workspace.getConfiguration('volar').get<'auto-kebab' | 'auto-pascal' | 'kebab' | 'pascal'>('preferredAttrNameCase');
                if (attrMode === 'kebab') {
                    attrCase = 'kebabCase';
                }
                else if (attrMode === 'pascal') {
                    attrCase = 'pascalCase';
                }
                else {
                    const templateCases = await languageClient.sendRequest(GetServerNameCasesRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(newDoc));
                    attrCase = getValidAttrCase(templateCases.attr);
                    if (templateCases.attr === 'both') {
                        if (attrMode === 'auto-kebab') {
                            attrCase = 'kebabCase';
                        }
                        else if (attrMode === 'auto-pascal') {
                            attrCase = 'pascalCase';
                        }
                    }
                }
            }
            attrCases.set(newDoc.uri.toString(), attrCase ?? 'unsure');
            updateStatusBarText(attrCase);
            statusBar.show();
        }
        else {
            statusBar.hide();
        }
    }
    function getValidAttrCase(attrCase: 'both' | 'kebabCase' | 'pascalCase' | 'unsure' | undefined): 'kebabCase' | 'pascalCase' {
        if (attrCase === 'both' || attrCase === 'unsure') {
            const attrMode = vscode.workspace.getConfiguration('volar').get<'auto-kebab' | 'auto-pascal' | 'kebab' | 'pascal'>('preferredAttrNameCase');
            if (attrMode === 'auto-kebab') {
                return 'kebabCase';
            }
            else if (attrMode === 'auto-pascal') {
                return 'pascalCase';
            }
            return 'kebabCase';
        }
        return attrCase ?? 'kebabCase';
    }
    function updateStatusBarText(
        attrCase: 'kebabCase' | 'pascalCase' | undefined,
    ) {
        let text = `Attr: `;
        if (attrCase === 'kebabCase' || attrCase === undefined) {
            text += `kebab-case`;
        }
        else if (attrCase === 'pascalCase') {
            text += `pascalCase`;
        }
        statusBar.text = text;
    }
}
