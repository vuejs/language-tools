/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { window, workspace, Disposable, TextDocument, Selection, TextEditor, TextEditorSelectionChangeKind, Range } from 'vscode';

export function activateTagEditing(tagProvider: (document: TextDocument, range: Range) => Thenable<Range | null | undefined>, supportedLanguages: { [id: string]: boolean }, configName: string): Disposable {

	let disposables: Disposable[] = [];
	window.onDidChangeTextEditorSelection(event => onDidChangeTextEditorSelection(event.kind, event.textEditor, event.selections), null, disposables);

	let isEnabled = false;
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
		if (kind !== TextEditorSelectionChangeKind.Mouse) {
			return;
		}
		if (!isEnabled) {
			return;
		}
		if (selections.length !== 1) {
			return;
		}
		const document = textEditor.document;
		const selection = selections[0];
		const otherRange = await tagProvider(document, selection);
		if (otherRange) {
			if (
				selection.anchor.line > selection.active.line
				|| (
					selection.anchor.line === selection.active.line
					&& selection.anchor.character > selection.active.character
				)
			) {
				textEditor.selections = [selection, new Selection(otherRange.end, otherRange.start)];
			}
			else {
				textEditor.selections = [selection, new Selection(otherRange.start, otherRange.end)];
			}
		}
	}
	return Disposable.from(...disposables);
}