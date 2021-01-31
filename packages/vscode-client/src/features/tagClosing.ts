import * as vscode from 'vscode';
import { TagCloseRequest } from '@volar/shared';
import type { LanguageClient } from 'vscode-languageclient/node';
import { window, workspace, Disposable, TextDocumentContentChangeEvent, TextDocument, Position, SnippetString } from 'vscode';

export async function activate(context: vscode.ExtensionContext, languageClient: LanguageClient) {
    await languageClient.onReady();
    context.subscriptions.push(activateTagClosing((document, position) => {
        let param = languageClient.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
        return languageClient.sendRequest(TagCloseRequest.type, param);
    }, { vue: true }, 'html.autoClosingTags'));
}

function activateTagClosing(tagProvider: (document: TextDocument, position: Position) => Thenable<string | null | undefined>, supportedLanguages: { [id: string]: boolean }, configName: string): Disposable {

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
        if (lastChange.rangeLength > 0 || lastCharacter !== '>' && lastCharacter !== '/') {
            return;
        }
        let rangeStart = lastChange.range.start;
        let version = document.version;
        timeout = setTimeout(() => {
            let position = new Position(rangeStart.line, rangeStart.character + lastChange.text.length);
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
        }, /* 100 */ 0);
    }
    return Disposable.from(...disposables);
}
