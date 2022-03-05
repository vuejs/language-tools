import * as vscode from 'vscode';
import * as shared from '@volar/shared';
import type { CommonLanguageClient } from 'vscode-languageclient';

export async function activate(context: vscode.ExtensionContext, htmlClient: CommonLanguageClient, tsClient: CommonLanguageClient) {
	await htmlClient.onReady();
	context.subscriptions.push(activateAutoInsertion(
		(document, position) => {
			const params = htmlClient.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
			return htmlClient.sendRequest(shared.GetAutoQuoteEditsRequest.type, params);
		},
		{ vue: true },
		'html.autoCreateQuotes',
		(lastChange, lastCharacter) => lastChange.rangeLength === 0 && lastCharacter === '=',
	));
	context.subscriptions.push(activateAutoInsertion(
		(document, position) => {
			const params = htmlClient.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
			return htmlClient.sendRequest(shared.GetTagCloseEditsRequest.type, params);
		},
		{ vue: true },
		'html.autoClosingTags',
		(lastChange, lastCharacter) => lastChange.rangeLength === 0 && (lastCharacter === '>' || lastCharacter === '/'),
	));
	context.subscriptions.push(activateAutoInsertion(
		async (document, position) => {
			const params = htmlClient.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
			const result = await htmlClient.sendRequest(shared.GetWrapParenthesesEditsRequest.type, params);
			if (result) {
				return {
					text: result.text,
					range: htmlClient.protocol2CodeConverter.asRange(result.range),
				};
			}
		},
		{ vue: true },
		'volar.autoWrapParentheses',
		isCharacterTyping,
	));
	context.subscriptions.push(activateAutoInsertion(
		(document, position) => {
			const params = tsClient.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
			return tsClient.sendRequest(shared.GetRefCompleteEditsRequest.type, params);
		},
		{
			vue: true,
			javascript: true,
			typescript: true,
			javascriptreact: true,
			typescriptreact: true,
		},
		'volar.autoCompleteRefs',
		isCharacterTyping,
	));

	function isCharacterTyping(lastChange: vscode.TextDocumentContentChangeEvent, lastCharacter: string, document: vscode.TextDocument) {

		const rangeStart = lastChange.range.start;
		const position = new vscode.Position(rangeStart.line, rangeStart.character + lastChange.text.length);
		const nextCharacter = document.getText(new vscode.Range(position, document.positionAt(document.offsetAt(position) + 1)));

		if (lastCharacter === undefined) { // delete text
			return false;
		}
		if (lastChange.text.indexOf('\n') >= 0) { // multi-line change
			return false;
		}
		return /\w/.test(lastCharacter) && !/\w/.test(nextCharacter)
	}
}

function activateAutoInsertion(
	provider: (document: vscode.TextDocument, position: vscode.Position) => Thenable<string | { text: string, range: vscode.Range } | null | undefined>,
	supportedLanguages: { [id: string]: boolean },
	configName: string,
	changeValid: (lastChange: vscode.TextDocumentContentChangeEvent, lastCharacter: string, document: vscode.TextDocument) => boolean,
): vscode.Disposable {

	let disposables: vscode.Disposable[] = [];
	vscode.workspace.onDidChangeTextDocument(onDidChangeTextDocument, null, disposables);

	let isEnabled = false;
	updateEnabledState();
	vscode.window.onDidChangeActiveTextEditor(updateEnabledState, null, disposables);

	let timeout: NodeJS.Timeout | undefined;

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
		if (!vscode.workspace.getConfiguration(undefined, document.uri).get<boolean>(configName, true)) {
			return;
		}
		isEnabled = true;
	}

	function onDidChangeTextDocument({ document, contentChanges, reason }: vscode.TextDocumentChangeEvent) {
		if (!isEnabled || contentChanges.length === 0 || reason === vscode.TextDocumentChangeReason.Undo || reason === vscode.TextDocumentChangeReason.Redo) {
			return;
		}
		const activeDocument = vscode.window.activeTextEditor?.document;
		if (document !== activeDocument) {
			return;
		}
		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}

		const lastChange = contentChanges[contentChanges.length - 1];
		const lastCharacter = lastChange.text[lastChange.text.length - 1];
		if (changeValid(lastChange, lastCharacter, document)) {
			doAutoInsert(document, lastChange);
		}
	}

	function doAutoInsert(document: vscode.TextDocument, lastChange: vscode.TextDocumentContentChangeEvent) {
		const rangeStart = lastChange.range.start;
		const version = document.version;
		timeout = setTimeout(() => {
			const position = new vscode.Position(rangeStart.line, rangeStart.character + lastChange.text.length);
			provider(document, position).then(text => {
				if (text && isEnabled) {
					const activeEditor = vscode.window.activeTextEditor;
					if (activeEditor) {
						const activeDocument = activeEditor.document;
						if (document === activeDocument && activeDocument.version === version) {
							if (typeof text === 'string') {
								const selections = activeEditor.selections;
								if (selections.length && selections.some(s => s.active.isEqual(position))) {
									activeEditor.insertSnippet(new vscode.SnippetString(text), selections.map(s => s.active));
								} else {
									activeEditor.insertSnippet(new vscode.SnippetString(text), position);
								}
							}
							else {
								activeEditor.insertSnippet(new vscode.SnippetString(text.text), text.range);
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
