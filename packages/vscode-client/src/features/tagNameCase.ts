import * as vscode from 'vscode';
import { userPick } from './splitEditors';
import { LanguageClient } from 'vscode-languageclient/node';
import { GetClientNameCasesRequest, GetServerNameCasesRequest, UriMap } from '@volar/shared';

export async function activate(context: vscode.ExtensionContext, languageClient: LanguageClient) {

    await languageClient.onReady();
    languageClient.onRequest(GetClientNameCasesRequest.type, async handler => {
        let tagCase = tagCases.get(handler.uri);
        let attrCase = attrCases.get(handler.uri);
        if (tagCase === 'unsure') {
            const templateCases = await languageClient.sendRequest(GetServerNameCasesRequest.type, handler);
            tagCase = templateCases.tag;
            tagCases.set(handler.uri, tagCase);
        }
        if (handler.uri.toLowerCase() === vscode.window.activeTextEditor?.document.uri.toString().toLowerCase()) {
            updateStatusBarText(tagCase, attrCase);
        }
        return {
            tag: !tagCase || tagCase === 'unsure' ? 'both' : tagCase,
            attr: attrCase ?? 'kebabCase',
        };
    });

    const tagCases = new UriMap<'both' | 'kebabCase' | 'pascalCase' | 'unsure'>();
    const attrCases = new UriMap<'kebabCase' | 'pascalCase'>();
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
    statusBar.command = 'volar.action.tagNameCase';

    onChangeDocument(vscode.window.activeTextEditor?.document);
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => {
        onChangeDocument(e?.document);
    }));
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => {
        tagCases.delete(doc.uri.toString());
    }));
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.tagNameCase', async () => {

        const crtDoc = vscode.window.activeTextEditor?.document;
        if (!crtDoc) return;

        const options = new Map<number, string>();

        // tag
        const tagCase = tagCases.get(crtDoc.uri.toString());
        options.set(0, (tagCase === 'both' ? '• ' : '') + 'Component Using kebab-case and PascalCase (Both)');
        options.set(1, (tagCase === 'kebabCase' ? '• ' : '') + 'Component Using kebab-case');
        options.set(2, (tagCase === 'pascalCase' ? '• ' : '') + 'Component Using PascalCase');
        options.set(3, 'Detect Component name from Content');
        // attr
        const attrCase = attrCases.get(crtDoc.uri.toString());
        options.set(4, (attrCase === 'kebabCase' ? '• ' : '') + 'Prop Using kebab-case');
        options.set(5, (attrCase === 'pascalCase' ? '• ' : '') + 'Prop Using pascalCase');
        options.set(6, 'Detect Prop name from Content');
        // Converts
        options.set(7, 'Convert Component name to kebab-case');
        options.set(8, 'Convert Component name to PascalCase');

        const select = await userPick(options);
        if (select === undefined) return; // cancle

        // tag
        if (select === 0) {
            tagCases.set(crtDoc.uri.toString(), 'both');
            updateStatusBarText('both', attrCase);
        }
        if (select === 1) {
            tagCases.set(crtDoc.uri.toString(), 'kebabCase');
            updateStatusBarText('kebabCase', attrCase);
        }
        if (select === 2) {
            tagCases.set(crtDoc.uri.toString(), 'pascalCase');
            updateStatusBarText('pascalCase', attrCase);
        }
        if (select === 3) {
            const detects = await languageClient.sendRequest(GetServerNameCasesRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(crtDoc));
            tagCases.set(crtDoc.uri.toString(), detects.tag);
            updateStatusBarText(detects.tag, attrCase);
        }
        // attr
        if (select === 4) {
            attrCases.set(crtDoc.uri.toString(), 'kebabCase');
            updateStatusBarText(tagCase, 'kebabCase');
        }
        if (select === 5) {
            attrCases.set(crtDoc.uri.toString(), 'pascalCase');
            updateStatusBarText(tagCase, 'pascalCase');
        }
        if (select === 6) {
            const detects = await languageClient.sendRequest(GetServerNameCasesRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(crtDoc));
            attrCases.set(crtDoc.uri.toString(), getValidAttrCase(detects.attr));
            updateStatusBarText(tagCase, getValidAttrCase(detects.attr));
        }
        if (select === 7) {
            vscode.commands.executeCommand('volar.action.tagNameCase.convertToKebabCase');
        }
        if (select === 8) {
            vscode.commands.executeCommand('volar.action.tagNameCase.convertToPascalCase');
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.tagNameCase.convertToKebabCase', async () => {
        if (vscode.window.activeTextEditor) {
            await vscode.commands.executeCommand('volar.server.executeConvertToKebabCase', vscode.window.activeTextEditor.document.uri.toString());
            tagCases.set(vscode.window.activeTextEditor.document.uri.toString(), 'kebabCase');
            updateStatusBarText('kebabCase', attrCases.get(vscode.window.activeTextEditor.document.uri.toString()));
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.tagNameCase.convertToPascalCase', async () => {
        if (vscode.window.activeTextEditor) {
            await vscode.commands.executeCommand('volar.server.executeConvertToPascalCase', vscode.window.activeTextEditor.document.uri.toString());
            tagCases.set(vscode.window.activeTextEditor.document.uri.toString(), 'pascalCase');
            updateStatusBarText('pascalCase', attrCases.get(vscode.window.activeTextEditor.document.uri.toString()));
        }
    }));

    async function onChangeDocument(newDoc: vscode.TextDocument | undefined) {
        if (newDoc?.languageId === 'vue') {
            let tagCase = tagCases.get(newDoc.uri.toString());
            let attrCase = attrCases.get(newDoc.uri.toString());
            if (!tagCase) {
                const tagMode = vscode.workspace.getConfiguration('volar').get<'auto' | 'both' | 'kebab' | 'pascal'>('preferredTagNameCase');
                if (tagMode === 'both') {
                    tagCase = 'both';
                }
                else if (tagMode === 'kebab') {
                    tagCase = 'kebabCase';
                }
                else if (tagMode === 'pascal') {
                    tagCase = 'pascalCase';
                }
                else {
                    const templateCases = await languageClient.sendRequest(GetServerNameCasesRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(newDoc));
                    tagCase = templateCases?.tag;
                }
            }
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
                    else {
                        tagCase = templateCases.tag;
                    }
                }
            }
            tagCases.set(newDoc.uri.toString(), tagCase);
            attrCases.set(newDoc.uri.toString(), attrCase ?? 'unsure');
            updateStatusBarText(tagCase, attrCase);
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
        tagCase: 'both' | 'kebabCase' | 'pascalCase' | 'unsure' | undefined,
        attrCase: 'kebabCase' | 'pascalCase' | undefined,
    ) {
        let text = `<`;
        if (tagCase === 'unsure' || tagCase === undefined) {
            text += `UNSURE`;
        }
        else if (tagCase === 'both') {
            text += `BOTH`;
        }
        else if (tagCase === 'kebabCase') {
            text += `tag-name`;
        }
        else if (tagCase === 'pascalCase') {
            text += `TagName`;
        }
        if (attrCase === 'kebabCase' || attrCase === undefined) {
            text += ` attr-name`;
        }
        else if (attrCase === 'pascalCase') {
            text += ` attrName`;
        }
        text += `>`;
        statusBar.text = text;
    }
}
