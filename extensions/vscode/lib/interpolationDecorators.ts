import * as vscode from 'vscode';
import { config } from './config';

const decorationType = vscode.window.createTextEditorDecorationType({
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'rgba(128, 128, 128, 0.5)',
	backgroundColor: 'rgba(200, 200, 200, 0.1)',
	borderRadius: '4px',
});

export function activate(
	context: vscode.ExtensionContext,
	selector: vscode.DocumentSelector,
) {
	let timeout: ReturnType<typeof setTimeout> | undefined;

	for (const editor of vscode.window.visibleTextEditors) {
		updateDecorations(editor);
	}

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor) {
				updateDecorations(editor);
			}
		}),
		vscode.workspace.onDidChangeTextDocument(() => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				clearTimeout(timeout);
				timeout = setTimeout(() => updateDecorations(editor), 100);
			}
		}),
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('vue.editor.templateInterpolationDecorators')) {
				for (const editor of vscode.window.visibleTextEditors) {
					updateDecorations(editor);
				}
			}
		}),
	);

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
