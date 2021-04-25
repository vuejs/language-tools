import * as vscode from 'vscode';
import { userPick } from './splitEditors';
import { LanguageClient } from 'vscode-languageclient/node';
import { GetTagStyleRequest, UriMap } from '@volar/shared';

export async function activate(context: vscode.ExtensionContext, languageClient: LanguageClient) {

    await languageClient.onReady();
    languageClient.onRequest(GetTagStyleRequest.type, handler => {
        return tagStyles.get(handler.uri) ?? 'both';
    });

    const tagStyles = new UriMap<'both' | 'kebabCase' | 'pascalCase'>();
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
    statusBar.command = 'volar.action.tagStyle';

    onChangeDocument(vscode.window.activeTextEditor?.document);
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => {
        onChangeDocument(e?.document);
    }));
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => {
        tagStyles.delete(doc.uri.toString());
    }));
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.tagStyle', async () => {

        const crtDoc = vscode.window.activeTextEditor?.document;
        if (!crtDoc) return;

        const crtTagStyle = tagStyles.get(crtDoc.uri.toString());
        const options = new Map<number, string>();
        options.set(0, (crtTagStyle === 'both' ? '• ' : '') + 'Component Using kebab-case and PascalCase (Both)');
        options.set(1, (crtTagStyle === 'kebabCase' ? '• ' : '') + 'Component Using kebab-case');
        options.set(2, (crtTagStyle === 'pascalCase' ? '• ' : '') + 'Component Using PascalCase');
        options.set(3, 'Detect Component name from Content');

        const select = await userPick(options);
        if (select === undefined) return; // cancle

        if (select === 0) {
            tagStyles.set(crtDoc.uri.toString(), 'both');
        }
        if (select === 1) {
            tagStyles.set(crtDoc.uri.toString(), 'kebabCase');
        }
        if (select === 2) {
            tagStyles.set(crtDoc.uri.toString(), 'pascalCase');
        }
        if (select === 3) {
            const detectStyle = await languageClient.sendRequest(GetTagStyleRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(crtDoc));
            tagStyles.set(crtDoc.uri.toString(), detectStyle);
        }
        onChangeDocument(crtDoc);
    }));

    async function onChangeDocument(newDoc: vscode.TextDocument | undefined) {
        if (newDoc?.languageId === 'vue') {
            const crtStyle = tagStyles.get(newDoc.uri.toString()) ?? await languageClient.sendRequest(GetTagStyleRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(newDoc));
            tagStyles.set(newDoc.uri.toString(), crtStyle);
            if (crtStyle === 'both') {
                statusBar.text = '<BOTH>';
            }
            else if (crtStyle === 'kebabCase') {
                statusBar.text = '<kebab-case>';
            }
            else if (crtStyle === 'pascalCase') {
                statusBar.text = '<PascalCase>';
            }
            statusBar.show();
        }
        else {
            statusBar.hide();
        }
    }
}
