/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { window, workspace, Disposable, TextDocument, Selection, TextEditor, TextEditorSelectionChangeKind, Range } from 'vscode';

export function activateTagEditing(tagProvider: (document: TextDocument, range: Range) => Thenable<Range | null | undefined>, supportedLanguages: { [id: string]: boolean }, configName: string): Disposable {

	let disposables: Disposable[] = [];
	window.onDidChangeTextEditorSelection(event => onDidChangeTextEditorSelection(event.kind, event.textEditor, event.selections), null, disposables);

	let isEnabled = false;
	let autoSelection = -1;
	updateEnabledState();
	window.onDidChangeActiveTextEditor(updateEnabledState, null, disposables);

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

	async function onDidChangeTextEditorSelection(kind: TextEditorSelectionChangeKind | undefined, textEditor: TextEditor, selections: readonly Selection[]) {
		const allowAdd = kind === TextEditorSelectionChangeKind.Mouse || kind === TextEditorSelectionChangeKind.Keyboard;
		const allowRemove = kind === TextEditorSelectionChangeKind.Mouse || kind === TextEditorSelectionChangeKind.Keyboard;
		if (!allowAdd && !allowRemove) {
			return;
		}
		if (!isEnabled) {
			return;
		}
		if (selections.length === 1) {
			if (allowAdd) {
				const document = textEditor.document;
				const selection = selections[0];
				const auto = await tagProvider(document, selection);
				if (auto) {
					textEditor.selections = [selection, isReverse(selection) ? new Selection(auto.end, auto.start) : new Selection(auto.start, auto.end)];
					autoSelection = 1;
				}
			}
		}
		else if (autoSelection >= 0 && selections.length > autoSelection) {
			const selection = selections.find((s, i) => i !== autoSelection);
			if (selection) {
				const document = textEditor.document;
				const newAuto = await tagProvider(document, selection);
				if (newAuto) {
					if (allowAdd) {
						const newSelections: Selection[] = [];
						for (let i = 0; i < selections.length; i++) {
							if (i === autoSelection) {
								newSelections.push(isReverse(selection) ? new Selection(newAuto.end, newAuto.start) : new Selection(newAuto.start, newAuto.end));
							}
							else {
								newSelections.push(selections[i]);
							}
						}
						textEditor.selections = newSelections;
					}
				}
				else {
					if (allowRemove) {
						textEditor.selections = textEditor.selections.filter((s, i) => i !== autoSelection);
						autoSelection = -1;
					}
				}
			}
			else {
				autoSelection = -1; // never
			}
		}
		else {
			if (allowRemove) {
				autoSelection = -1;
			}
		}
	}
	return Disposable.from(...disposables);
}

function isReverse(selection: Selection) {
	if (
		selection.anchor.line > selection.active.line
		|| (
			selection.anchor.line === selection.active.line
			&& selection.anchor.character > selection.active.character
		)
	) {
		return true;
	}
	return false;
}
