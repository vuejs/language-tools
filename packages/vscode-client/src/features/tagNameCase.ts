import * as vscode from 'vscode';
import { userPick } from './splitEditors';
import { LanguageClient } from 'vscode-languageclient/node';
import { GetTagStyleRequest, UriMap } from '@volar/shared';

export async function activate(context: vscode.ExtensionContext, languageClient: LanguageClient) {

    await languageClient.onReady();
    languageClient.onRequest(GetTagStyleRequest.type, async handler => {
        let crtStyle = tagStyles.get(handler.uri);
        if (crtStyle === 'unsure') {
            crtStyle = await languageClient.sendRequest(GetTagStyleRequest.type, handler);
            tagStyles.set(handler.uri, crtStyle);
            if (handler.uri.toLowerCase() === vscode.window.activeTextEditor?.document.uri.toString().toLowerCase()) {
                updateStatusBarText(crtStyle);
            }
        }
        return crtStyle ?? 'both';
    });

    const tagStyles = new UriMap<'both' | 'kebabCase' | 'pascalCase' | 'unsure'>();
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
    statusBar.command = 'volar.action.tagNameCase';

    onChangeDocument(vscode.window.activeTextEditor?.document);
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => {
        onChangeDocument(e?.document);
    }));
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => {
        tagStyles.delete(doc.uri.toString());
    }));
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.tagNameCase', async () => {

        const crtDoc = vscode.window.activeTextEditor?.document;
        if (!crtDoc) return;

        const crtTagStyle = tagStyles.get(crtDoc.uri.toString());
        const options = new Map<number, string>();
        options.set(0, (crtTagStyle === 'both' ? '• ' : '') + 'Component Using kebab-case and PascalCase (Both)');
        options.set(1, (crtTagStyle === 'kebabCase' ? '• ' : '') + 'Component Using kebab-case');
        options.set(2, (crtTagStyle === 'pascalCase' ? '• ' : '') + 'Component Using PascalCase');
        options.set(3, 'Detect Component name from Content');
        // Converts
        options.set(4, 'Convert Component name to kebab-case');
        options.set(5, 'Convert Component name to PascalCase');

        const select = await userPick(options);
        if (select === undefined) return; // cancle

        if (select === 0) {
            tagStyles.set(crtDoc.uri.toString(), 'both');
            updateStatusBarText('both');
        }
        if (select === 1) {
            tagStyles.set(crtDoc.uri.toString(), 'kebabCase');
            updateStatusBarText('kebabCase');
        }
        if (select === 2) {
            tagStyles.set(crtDoc.uri.toString(), 'pascalCase');
            updateStatusBarText('pascalCase');
        }
        if (select === 3) {
            const detectStyle = await languageClient.sendRequest(GetTagStyleRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(crtDoc));
            tagStyles.set(crtDoc.uri.toString(), detectStyle);
            updateStatusBarText(detectStyle);
        }
        if (select === 4) {
            vscode.commands.executeCommand('volar.action.tagNameCase.convertToKebabCase');
        }
        if (select === 5) {
            vscode.commands.executeCommand('volar.action.tagNameCase.convertToPascalCase');
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.tagNameCase.convertToKebabCase', async () => {
        if (vscode.window.activeTextEditor) {
            await vscode.commands.executeCommand('volar.server.executeConvertToKebabCase', vscode.window.activeTextEditor.document.uri.toString());
            tagStyles.set(vscode.window.activeTextEditor.document.uri.toString(), 'kebabCase');
            updateStatusBarText('kebabCase');
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.tagNameCase.convertToPascalCase', async () => {
        if (vscode.window.activeTextEditor) {
            await vscode.commands.executeCommand('volar.server.executeConvertToPascalCase', vscode.window.activeTextEditor.document.uri.toString());
            tagStyles.set(vscode.window.activeTextEditor.document.uri.toString(), 'pascalCase');
            updateStatusBarText('pascalCase');
        }
    }));

    async function onChangeDocument(newDoc: vscode.TextDocument | undefined) {
        if (newDoc?.languageId === 'vue') {
            let crtStyle = tagStyles.get(newDoc.uri.toString());
            if (!crtStyle) {
                const mode = vscode.workspace.getConfiguration('volar').get<string>('preferredTagNameCase');
                if (mode === 'both') {
                    crtStyle = 'both';
                }
                else if (mode === 'kebab') {
                    crtStyle = 'kebabCase';
                }
                else if (mode === 'pascal') {
                    crtStyle = 'pascalCase';
                }
                else {
                    crtStyle = await languageClient.sendRequest(GetTagStyleRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(newDoc));
                }
            }
            tagStyles.set(newDoc.uri.toString(), crtStyle);
            updateStatusBarText(crtStyle);
            statusBar.show();
        }
        else {
            statusBar.hide();
        }
    }
    function updateStatusBarText(crtStyle: "both" | "kebabCase" | "pascalCase" | "unsure") {
        if (crtStyle === 'unsure') {
            statusBar.text = '<UNSURE>';
        }
        if (crtStyle === 'both') {
            statusBar.text = '<BOTH>';
        }
        else if (crtStyle === 'kebabCase') {
            statusBar.text = '<kebab-case>';
        }
        else if (crtStyle === 'pascalCase') {
            statusBar.text = '<PascalCase>';
        }
    }
}
