import * as vscode from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { AutoInsertRequest } from '@volar/language-server';

export async function register(
	context: vscode.ExtensionContext,
	clients: BaseLanguageClient[],
	active: (document: vscode.TextDocument) => boolean,
) {

	let isEnabled = false;
	let timeout: NodeJS.Timeout | undefined;

	updateEnabledState();

	vscode.workspace.onDidChangeTextDocument(onDidChangeTextDocument, null, context.subscriptions);
	vscode.window.onDidChangeActiveTextEditor(updateEnabledState, null, context.subscriptions);

	function updateEnabledState() {
		isEnabled = false;
		let editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		let document = editor.document;
		if (!active(document)) {
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

		doAutoInsert(document, lastChange, async (document, position, lastChange, isCancel) => {

			for (const client of clients) {

				const params = {
					...client.code2ProtocolConverter.asTextDocumentPositionParams(document, position),
					options: {
						lastChange: {
							...lastChange,
							range: client.code2ProtocolConverter.asRange(lastChange.range),
						},
					},
				};

				if (isCancel()) return;

				const result = await client.sendRequest(AutoInsertRequest.type, params);

				if (result !== undefined && result !== null) {
					if (typeof result === 'string') {
						return result;
					}
					else {
						return client.protocol2CodeConverter.asTextEdit(result);
					}
				}
			}
		});
	}

	function doAutoInsert(
		document: vscode.TextDocument,
		lastChange: vscode.TextDocumentContentChangeEvent,
		provider: (document: vscode.TextDocument, position: vscode.Position, lastChange: vscode.TextDocumentContentChangeEvent, isCancel: () => boolean) => Thenable<string | vscode.TextEdit | null | undefined>,
	) {
		const version = document.version;
		timeout = setTimeout(() => {
			const position = vscode.window.activeTextEditor?.selections.length === 1 && vscode.window.activeTextEditor.selections[0].active;
			if (position) {
				provider(document, position, lastChange, () => vscode.window.activeTextEditor?.document.version !== version).then(text => {
					if (text && isEnabled) {
						const activeEditor = vscode.window.activeTextEditor;
						if (activeEditor) {
							const activeDocument = activeEditor.document;
							if (document === activeDocument && activeDocument.version === version) {
								if (typeof text === 'string') {
									const selections = activeEditor.selections;
									if (selections.length && selections.some(s => s.active.isEqual(position))) {
										activeEditor.insertSnippet(new vscode.SnippetString(text), selections.map(s => s.active));
									}
									else {
										activeEditor.insertSnippet(new vscode.SnippetString(text), position);
									}
								}
								else {
									activeEditor.insertSnippet(new vscode.SnippetString(text.newText), text.range);
								}
							}
						}
					}
				});
			}
			timeout = undefined;
		}, 100);
	}
}
