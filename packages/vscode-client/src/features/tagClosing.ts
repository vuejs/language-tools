import * as vscode from 'vscode';
import { TagCloseRequest, RefCloseRequest } from '@volar/shared';
import type { LanguageClient } from 'vscode-languageclient/node';
import { window, workspace, Disposable, TextDocumentContentChangeEvent, TextDocument, Position, SnippetString } from 'vscode';

export async function activate(context: vscode.ExtensionContext, htmlClient: LanguageClient, tsClient: LanguageClient) {
    await htmlClient.onReady();
    context.subscriptions.push(activateTagClosing(
        (document, position) => {
            let param = htmlClient.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
            return htmlClient.sendRequest(TagCloseRequest.type, param);
        },
        { vue: true },
        'html.autoClosingTags',
        (rangeLength, lastCharacter) => rangeLength <= 0 && (lastCharacter === '>' || lastCharacter === '/'),
    ));
    context.subscriptions.push(activateTagClosing(
        (document, position) => {
            let param = tsClient.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
            return tsClient.sendRequest(RefCloseRequest.type, param);
        },
        {
            vue: true,
            javascript: true,
            typescript: true,
            javascriptreact: true,
            typescriptreact: true,
        },
        'volar.autoCompleteRefs',
        (_, lastCharacter, nextCharacter) => lastCharacter !== '>' && lastCharacter !== '/' && !nextCharacter.trim(),
    ));
}

function activateTagClosing(
    tagProvider: (document: TextDocument, position: Position) => Thenable<string | null | undefined>,
    supportedLanguages: { [id: string]: boolean },
    configName: string,
    changeValid: (rangeLength: number, lastCharacter: string, nextCharacter: string) => boolean,
): Disposable {

    let disposables: Disposable[] = [];
    workspace.onDidChangeTextDocument(event => onDidChangeTextDocument(event.document, event.contentChanges), null, disposables);

    let isEnabled = false;
    updateEnabledState();
    window.onDidChangeActiveTextEditor(updateEnabledState, null, disposables);

    let timeout: NodeJS.Timer | undefined = undefined;

    function updateEnabledState() {
        isEnabled = false;
        let editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        let document = editor.document;
        if (!supportedLanguages[document.languageId]) {
            return;
        }
        if (!workspace.getConfiguration(undefined, document.uri).get<boolean>(configName)) {
            return;
        }
        isEnabled = true;
    }

    function onDidChangeTextDocument(document: TextDocument, changes: readonly TextDocumentContentChangeEvent[]) {
        if (!isEnabled) {
            return;
        }
        let activeDocument = window.activeTextEditor && window.activeTextEditor.document;
        if (document !== activeDocument || changes.length === 0) {
            return;
        }
        if (typeof timeout !== 'undefined') {
            clearTimeout(timeout);
        }
        let lastChange = changes[changes.length - 1];
        let lastCharacter = lastChange.text[lastChange.text.length - 1];
        if (lastCharacter === undefined) { // delete text
            return;
        }
        if (lastChange.text.indexOf('\n') >= 0) { // multi-line change
            return;
        }
        let rangeStart = lastChange.range.start;
        let version = document.version;
        let position = new Position(rangeStart.line, rangeStart.character + lastChange.text.length);
        let nextCharacter = document.getText(new vscode.Range(position, document.positionAt(document.offsetAt(position) + 1)));
        if (!changeValid(lastChange.rangeLength, lastCharacter, nextCharacter)) {
            return;
        }
        timeout = setTimeout(() => {
            tagProvider(document, position).then(text => {
                if (text && isEnabled) {
                    let activeEditor = window.activeTextEditor;
                    if (activeEditor) {
                        let activeDocument = activeEditor.document;
                        if (document === activeDocument && activeDocument.version === version) {
                            let selections = activeEditor.selections;
                            if (selections.length && selections.some(s => s.active.isEqual(position))) {
                                activeEditor.insertSnippet(new SnippetString(text), selections.map(s => s.active));
                            } else {
                                activeEditor.insertSnippet(new SnippetString(text), position);
                            }
                        }
                    }
                }
            });
            timeout = undefined;
        }, 100);
    }
    return Disposable.from(...disposables);
}
