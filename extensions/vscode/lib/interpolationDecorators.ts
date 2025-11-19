import { useActiveTextEditor, useDocumentText, useVisibleTextEditors, watch } from 'reactive-vscode';
import * as vscode from 'vscode';
import { config } from './config';

const decorationType = vscode.window.createTextEditorDecorationType({
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'rgba(128, 128, 128, 0.5)',
	backgroundColor: 'rgba(200, 200, 200, 0.1)',
	borderRadius: '4px',
});

export function activate(selector: vscode.DocumentSelector) {
	let timeout: ReturnType<typeof setTimeout> | undefined;

	const visibleTextEditors = useVisibleTextEditors();
	const activeTextEditor = useActiveTextEditor();
	const activeText = useDocumentText(() => activeTextEditor.value?.document);

	for (const editor of visibleTextEditors.value) {
		updateDecorations(editor);
	}

	watch(activeTextEditor, editor => {
		if (editor) {
			updateDecorations(editor);
		}
	});

	watch(activeText, () => {
		const editor = activeTextEditor.value;
		if (editor) {
			clearTimeout(timeout);
			timeout = setTimeout(() => updateDecorations(editor), 100);
		}
	});

	watch(() => config.editor.templateInterpolationDecorators, () => {
		for (const editor of visibleTextEditors.value) {
			updateDecorations(editor);
		}
	});

	function updateDecorations(editor: vscode.TextEditor) {
		if (!vscode.languages.match(selector, editor.document)) {
			return;
		}
		if (!config.editor.templateInterpolationDecorators) {
			editor.setDecorations(decorationType, []);
			return;
		}
		editor.setDecorations(
			decorationType,
			[...editor.document.getText().matchAll(/{{[\s\S]*?}}/g)].map(match => {
				const start = match.index + 2;
				const end = match.index + match[0].length - 2;
				return new vscode.Range(
					editor.document.positionAt(start),
					editor.document.positionAt(end),
				);
			}),
		);
	}
}
