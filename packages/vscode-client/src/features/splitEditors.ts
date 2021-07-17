import * as vscode from 'vscode';
import { parse, SFCBlock } from '@vue/compiler-sfc';
import { ref, computed } from '@vue/reactivity';
import { notEmpty, sleep } from '@volar/shared';

export function activate(context: vscode.ExtensionContext) {

	const getDocDescriptor = useDocDescriptor();
	let lastEditorIsSplitMode = false;
	let splits: {
		types: string[],
		uri: string,
		viewColumn?: vscode.ViewColumn,
	}[] = [];
	vscode.workspace.onDidCloseTextDocument(closeDoc => {
		splits = splits.filter(split => split.uri !== closeDoc.uri.toString());
	});
	vscode.window.onDidChangeTextEditorSelection(async change => {

		const split = splits.find(split => split.uri === change.textEditor.document.uri.toString() && split.viewColumn === change.textEditor.viewColumn);
		if (!lastEditorIsSplitMode) {
			lastEditorIsSplitMode = !!split;
			return;
		}
		lastEditorIsSplitMode = !!split;
		if (!split) return;

		const validSplit = getValidSplit(change.textEditor, change.textEditor.selections);
		if (validSplit && validSplit.viewColumn !== change.textEditor.viewColumn) {

			const visibleRanges = change.textEditor.visibleRanges;
			const selection = change.selections[0];

			await vscode.commands.executeCommand('workbench.action.navigateBack');
			change.textEditor.revealRange(visibleRanges[0]);

			await vscode.window.showTextDocument(change.textEditor.document, validSplit.viewColumn);
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				editor.selection = selection;
				editor.revealRange(selection);
			}
		}
	});

	context.subscriptions.push(vscode.commands.registerCommand('volar.action.splitEditors', async _ => onSplit(0)));
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.splitEditors2', async _ => onSplit(1)));

	async function onSplit(option: number) {
		splits.length = 0;

		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		const doc = editor.document;
		const descriptor = getDocDescriptor(doc.getText());
		const blocksSet: SFCBlock[][] = [];

		if (descriptor.scriptSetup || descriptor.script) {
			blocksSet.push([descriptor.scriptSetup, descriptor.script].filter(notEmpty));
		}
		if (descriptor.template) {
			blocksSet.push([descriptor.template]);
		}
		if (descriptor.styles.length) {
			blocksSet.push(descriptor.styles);
		}
		if (descriptor.customBlocks.length) {
			blocksSet.push(descriptor.customBlocks);
		}

		for (let i = 0; i < blocksSet.length; i++) {
			const blocks = blocksSet[i];
			const firstBlock = blocks.sort((a, b) => a.loc.start.offset - b.loc.start.offset)[0];
			if (i !== 0 && i % 2 === 1) {
				await vscode.commands.executeCommand('workbench.action.splitEditorRight');
			}
			if (i !== 0 && i % 2 === 0) {
				await vscode.commands.executeCommand('workbench.action.splitEditorDown');
			}
			const editor = vscode.window.activeTextEditor;
			if (!editor) break;
			await vscode.commands.executeCommand('editor.unfoldAll');
			editor.selections = blocks.map(block => new vscode.Selection(doc.positionAt(block.loc.start.offset), doc.positionAt(block.loc.start.offset)));
			await vscode.commands.executeCommand('editor.foldLevel1');
			editor.revealRange(new vscode.Range(doc.positionAt(firstBlock.loc.start.offset), new vscode.Position(editor.document.lineCount, 0)), vscode.TextEditorRevealType.AtTop);
			if (option === 1) {
				splits.push({
					types: blocks.map(block => block.type),
					uri: editor.document.uri.toString(),
					viewColumn: editor.viewColumn,
				});
			}
			lastEditorIsSplitMode = true;
		}

		if (option === 1) {
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				cancellable: true,
				title: `On split editing mode...`,
			}, async (progress, token) => {
				while (!token.isCancellationRequested && splits.length) {
					await sleep(100);
				}
				splits.length = 0;
			});
		}
	}

	function getValidSplit(editor: vscode.TextEditor, selections: readonly vscode.Selection[]) {
		for (const split of splits) {
			if (split.uri !== editor.document.uri.toString()) {
				continue;
			}
			const descriptor = getDocDescriptor(editor.document.getText());
			const blocks = [
				descriptor.script,
				descriptor.scriptSetup,
				descriptor.template,
				...descriptor.styles,
				...descriptor.customBlocks,
			].filter(notEmpty);
			const selection = selections[selections.length - 1];
			const start = editor.document.offsetAt(selection.start);
			const end = editor.document.offsetAt(selection.end);
			const validBlocks = blocks.filter(block => split.types.includes(block.type));
			for (const validBlock of validBlocks) {
				if (validBlock.loc.start.offset <= start && validBlock.loc.end.offset >= end) {
					return split;
				}
			}
		}
	}
}

function useDocDescriptor() {

	const splitDocText = ref('');
	const splitDocDescriptor = computed(() => parse(splitDocText.value, { sourceMap: false }).descriptor);

	return getDescriptor;

	function getDescriptor(text: string) {
		splitDocText.value = text;
		return splitDocDescriptor.value;
	}
}
export function userPick<K>(options: Map<K, string>, placeholder?: string) {
	return new Promise<K | undefined>(resolve => {
		const quickPick = vscode.window.createQuickPick();
		quickPick.items = [...options.values()].map(option => ({ label: option }));
		quickPick.placeholder = placeholder;
		quickPick.onDidChangeSelection(selection => {
			if (selection[0]) {
				for (const [key, label] of options) {
					if (selection[0].label === label) {
						resolve(key);
						quickPick.hide();
					}
				}
			}
		});
		quickPick.onDidHide(() => {
			quickPick.dispose();
			resolve(undefined);
		})
		quickPick.show();
	});
}
