import type { getReactiveReferences } from '@vue/typescript-plugin/lib/requests/getReactiveReferences';
import * as vscode from 'vscode';
import { config } from './config';

const dependenciesDecorations = vscode.window.createTextEditorDecorationType({
	isWholeLine: true,
	backgroundColor: 'rgba(120,120,255,0.1)',
	border: '1px solid rgba(120,120,255,0.6)',
	borderWidth: '0 0 0 3px',
	// after: {
	//   contentText: '   dependents',
	//   color: 'rgba(120,120,255,0.6)',
	// },
});
const subscribersDecorations = vscode.window.createTextEditorDecorationType({
	// outlineColor: 'rgba(80,200,80,0.6)',
	// outlineStyle: 'dashed',
	// borderRadius: '3px',
	isWholeLine: true,
	backgroundColor: 'rgba(80,200,80,0.1)',
	border: '1px solid rgba(80,200,80,0.6)',
	borderWidth: '0 0 0 3px',
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
		vscode.window.onDidChangeTextEditorSelection(() => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				clearTimeout(timeout);
				timeout = setTimeout(() => updateDecorations(editor), 100);
			}
		}),
	);

	async function updateDecorations(editor: vscode.TextEditor) {
		const { document } = editor;
		if (document.uri.scheme !== 'file') {
			return;
		}
		if (
			!vscode.languages.match(selector, document)
			&& document.languageId !== 'typescript'
			&& document.languageId !== 'javascript'
			&& document.languageId !== 'typescriptreact'
			&& document.languageId !== 'javascriptreact'
		) {
			return;
		}
		if (!config.editor.reactivityVisualization) {
			editor.setDecorations(dependenciesDecorations, []);
			editor.setDecorations(subscribersDecorations, []);
			return;
		}

		try {
			const result = await vscode.commands.executeCommand<
				{
					body?: ReturnType<typeof getReactiveReferences>;
				} | undefined
			>(
				'typescript.tsserverRequest',
				'_vue:getReactiveReferences',
				[
					document.uri.fsPath.replace(/\\/g, '/'),
					document.offsetAt(editor.selection.active),
				],
				{ isAsync: true, lowPriority: true },
			);
			editor.setDecorations(
				dependenciesDecorations,
				result?.body?.dependencyRanges.map(range =>
					new vscode.Range(
						document.positionAt(range.start),
						document.positionAt(range.end),
					)
				) ?? [],
			);
			editor.setDecorations(
				subscribersDecorations,
				result?.body?.dependentRanges.map(range =>
					new vscode.Range(
						document.positionAt(range.start),
						document.positionAt(range.end),
					)
				) ?? [],
			);
		}
		catch {
			editor.setDecorations(dependenciesDecorations, []);
			editor.setDecorations(subscribersDecorations, []);
		}
	}
}
