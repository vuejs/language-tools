import * as vscode from 'vscode';
import { config } from './config';

const tagUnfocusDecorations = Array.from({ length: 8 }).map((_, i) =>
	vscode.window.createTextEditorDecorationType({
		opacity: Math.pow(0.7, i).toString(),
		isWholeLine: true,
	})
);

export function activate(
	context: vscode.ExtensionContext,
	selector: vscode.DocumentSelector,
) {
	let timeout: ReturnType<typeof setTimeout> | undefined;

	const editor2Decorations = new Map<vscode.TextEditor, {
		currentTagDecIndex: number;
		targetTagDecIndex: number;
		tagRanges: [number, number][];
	}>();

	setInterval(() => {
		for (const [editor, info] of Array.from(editor2Decorations)) {
			if (info.currentTagDecIndex !== info.targetTagDecIndex) {
				const lastTagDecIndex = info.currentTagDecIndex;

				if (info.targetTagDecIndex > info.currentTagDecIndex) {
					info.currentTagDecIndex++;
				}
				else {
					info.currentTagDecIndex--;
				}

				if (info.currentTagDecIndex > 0) {
					editor.setDecorations(
						tagUnfocusDecorations[info.currentTagDecIndex]!,
						info.tagRanges.map(range =>
							new vscode.Range(new vscode.Position(range[0], 0), new vscode.Position(range[1], 0))
						),
					);
				}
				editor.setDecorations(tagUnfocusDecorations[lastTagDecIndex]!, []);
			}
			if (info.currentTagDecIndex === 0 && info.targetTagDecIndex === 0) {
				editor2Decorations.delete(editor);
			}
		}
	}, 24);

	context.subscriptions.push(
		vscode.window.onDidChangeVisibleTextEditors(editors => {
			for (const [editor, info] of editor2Decorations) {
				if (!editors.includes(editor)) {
					info.targetTagDecIndex = 0;
				}
			}
		}),
		vscode.window.onDidChangeTextEditorSelection(editor => {
			updateDecorations(editor.textEditor);
		}),
		vscode.workspace.onDidChangeTextDocument(() => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				clearTimeout(timeout);
				timeout = setTimeout(() => updateDecorations(editor), 100);
			}
		}),
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('vue.editor.focusMode')) {
				for (const editor of vscode.window.visibleTextEditors) {
					updateDecorations(editor);
				}
			}
		}),
	);

	async function updateDecorations(editor: vscode.TextEditor) {
		if (!vscode.languages.match(selector, editor.document)) {
			return;
		}

		const foldingRanges = await vscode.commands.executeCommand<vscode.FoldingRange[] | undefined>(
			'vscode.executeFoldingRangeProvider',
			editor.document.uri,
		);
		if (!foldingRanges) {
			return;
		}

		const rootRanges: vscode.FoldingRange[] = [];
		const stack: vscode.FoldingRange[] = [];

		for (const range of foldingRanges) {
			while (stack.length && stack[stack.length - 1]!.end < range.start) {
				stack.pop();
			}
			if (stack.length === 0) {
				rootRanges.push({
					start: range.start,
					end: range.end + 1,
				});
			}
			stack.push(range);
		}

		const info = editor2Decorations.get(editor) ?? {
			currentTagDecIndex: 0,
			targetTagDecIndex: 0,
			tagRanges: [],
		};
		editor2Decorations.set(editor, info);

		info.tagRanges.length = 0;

		const currentLine = editor.selection.active.line;
		let inBlock = false;

		for (const rootRange of rootRanges) {
			if (rootRange.end - rootRange.start <= 1) {
				info.tagRanges.push([rootRange.start, rootRange.end]);
			}
			else {
				info.tagRanges.push([rootRange.start, rootRange.start]);
				info.tagRanges.push([rootRange.end, rootRange.end]);
				inBlock ||= currentLine >= rootRange.start + 1 && currentLine <= rootRange.end - 1;
			}
		}

		if (config.editor.focusMode && inBlock) {
			info.targetTagDecIndex = tagUnfocusDecorations.length - 1;
		}
		else {
			info.targetTagDecIndex = 0;
		}
	}
}
