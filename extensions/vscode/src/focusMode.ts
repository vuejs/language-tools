import {
	useActiveTextEditor,
	useDocumentText,
	useTextEditorSelection,
	useVisibleTextEditors,
	watch,
} from 'reactive-vscode';
import * as vscode from 'vscode';
import { config } from './config';

const tagUnfocusDecorations = Array.from({ length: 8 }).map((_, i) =>
	vscode.window.createTextEditorDecorationType({
		opacity: Math.pow(0.7, i).toString(),
		isWholeLine: true,
	})
);

export function activate(selector: vscode.DocumentSelector) {
	const editor2Decorations = new Map<vscode.TextEditor, {
		currentTagDecIndex: number;
		targetTagDecIndex: number;
		tagRanges: [number, number][];
	}>();

	// folding ranges only depend on the document text, not the selection
	const foldingCache = new WeakMap<vscode.TextDocument, {
		version: number;
		rootRanges: vscode.FoldingRange[];
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

	const visibleTextEditors = useVisibleTextEditors();
	const activeTextEditor = useActiveTextEditor();
	const activeSelection = useTextEditorSelection(activeTextEditor);
	const activeText = useDocumentText(() => activeTextEditor.value?.document);

	watch(visibleTextEditors, editors => {
		for (const [editor, info] of editor2Decorations) {
			if (!editors.includes(editor)) {
				info.targetTagDecIndex = 0;
			}
		}
	});

	let timeout: NodeJS.Timeout | undefined;
	function scheduleUpdateDecorations() {
		clearTimeout(timeout);
		timeout = setTimeout(() => {
			if (activeTextEditor.value) {
				updateDecorations(activeTextEditor.value);
			}
		}, 100);
	}

	watch(activeSelection, scheduleUpdateDecorations);
	watch(activeText, scheduleUpdateDecorations);

	watch(() => config.editor.focusMode, () => {
		for (const editor of visibleTextEditors.value) {
			updateDecorations(editor);
		}
	});

	async function updateDecorations(editor: vscode.TextEditor) {
		if (!config.editor.focusMode) {
			const info = editor2Decorations.get(editor);
			if (info) {
				info.targetTagDecIndex = 0;
			}
			return;
		}

		if (!vscode.languages.match(selector, editor.document)) {
			return;
		}

		let cache = foldingCache.get(editor.document);
		if (!cache || cache.version !== editor.document.version) {
			// capture the version before the request
			const version = editor.document.version;
			const foldingRanges = await vscode.commands.executeCommand<vscode.FoldingRange[] | undefined>(
				'vscode.executeFoldingRangeProvider',
				editor.document.uri,
			);
			if (!foldingRanges) {
				return;
			}
			cache = { version, rootRanges: computeRootFoldingRanges(foldingRanges) };
			if (foldingRanges.length) {
				foldingCache.set(editor.document, cache);
			}
		}

		const { tagRanges, inBlock } = computeTagRanges(cache.rootRanges, editor.selection.active.line);

		const info = editor2Decorations.get(editor) ?? {
			currentTagDecIndex: 0,
			targetTagDecIndex: 0,
			tagRanges: [],
		};
		editor2Decorations.set(editor, info);
		info.tagRanges = tagRanges;

		if (config.editor.focusMode && inBlock) {
			info.targetTagDecIndex = tagUnfocusDecorations.length - 1;
		}
		else {
			info.targetTagDecIndex = 0;
		}
	}
}

function computeRootFoldingRanges(foldingRanges: readonly vscode.FoldingRange[]) {
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

	return rootRanges;
}

function computeTagRanges(rootRanges: readonly vscode.FoldingRange[], currentLine: number) {
	const tagRanges: [number, number][] = [];
	let inBlock = false;

	for (const rootRange of rootRanges) {
		if (rootRange.end - rootRange.start <= 1) {
			tagRanges.push([rootRange.start, rootRange.end]);
		}
		else {
			tagRanges.push([rootRange.start, rootRange.start]);
			tagRanges.push([rootRange.end, rootRange.end]);
			inBlock ||= currentLine >= rootRange.start + 1 && currentLine <= rootRange.end - 1;
		}
	}

	return { tagRanges, inBlock };
}
