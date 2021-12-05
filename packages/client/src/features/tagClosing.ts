import * as vscode from 'vscode';
import * as shared from '@volar/shared';
import type { CommonLanguageClient } from 'vscode-languageclient';

export async function activate(context: vscode.ExtensionContext, htmlClient: CommonLanguageClient, tsClient: CommonLanguageClient) {
	await htmlClient.onReady();
	context.subscriptions.push(activateTagClosing(
		(document, position) => {
			let param = htmlClient.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
			return htmlClient.sendRequest(shared.GetTagCloseEditsRequest.type, param);
		},
		{ vue: true },
		'html.autoClosingTags',
		(rangeLength, lastCharacter) => rangeLength <= 0 && (lastCharacter === '>' || lastCharacter === '/'),
	));
	context.subscriptions.push(activateTagClosing(
		(document, position) => {
			let param = tsClient.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
			return tsClient.sendRequest(shared.GetRefCompleteEditsRequest.type, param);
		},
		{
			vue: true,
			javascript: true,
			typescript: true,
			javascriptreact: true,
			typescriptreact: true,
		},
		'volar.autoCompleteRefs',
		(_, lastCharacter, nextCharacter) => /\w/.test(lastCharacter) && !/\w/.test(nextCharacter),
	));
}

function activateTagClosing(
	tagProvider: (document: vscode.TextDocument, position: vscode.Position) => Thenable<string | null | undefined>,
	supportedLanguages: { [id: string]: boolean },
	configName: string,
	changeValid: (rangeLength: number, lastCharacter: string, nextCharacter: string) => boolean,
): vscode.Disposable {

	let disposables: vscode.Disposable[] = [];
	vscode.workspace.onDidChangeTextDocument(event => onDidChangeTextDocument(event.document, event.contentChanges), null, disposables);

	let isEnabled = false;
	updateEnabledState();
	vscode.window.onDidChangeActiveTextEditor(updateEnabledState, null, disposables);

	let timeout: NodeJS.Timer | undefined = undefined;

	function updateEnabledState() {
		isEnabled = false;
		let editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		let document = editor.document;
		if (!supportedLanguages[document.languageId]) {
			return;
		}
		if (!vscode.workspace.getConfiguration(undefined, document.uri).get<boolean>(configName)) {
			return;
		}
		isEnabled = true;
	}

	function onDidChangeTextDocument(document: vscode.TextDocument, changes: readonly vscode.TextDocumentContentChangeEvent[]) {
		if (!isEnabled) {
			return;
		}
		let activeDocument = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document;
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
		let position = new vscode.Position(rangeStart.line, rangeStart.character + lastChange.text.length);
		let nextCharacter = document.getText(new vscode.Range(position, document.positionAt(document.offsetAt(position) + 1)));
		if (!changeValid(lastChange.rangeLength, lastCharacter, nextCharacter)) {
			return;
		}
		timeout = setTimeout(() => {
			tagProvider(document, position).then(text => {
				if (text && isEnabled) {
					let activeEditor = vscode.window.activeTextEditor;
					if (activeEditor) {
						let activeDocument = activeEditor.document;
						if (document === activeDocument && activeDocument.version === version) {
							let selections = activeEditor.selections;
							if (selections.length && selections.some(s => s.active.isEqual(position))) {
								activeEditor.insertSnippet(new vscode.SnippetString(text), selections.map(s => s.active));
							} else {
								activeEditor.insertSnippet(new vscode.SnippetString(text), position);
							}
						}
					}
				}
			});
			timeout = undefined;
		}, 100);
	}
	return vscode.Disposable.from(...disposables);
}
