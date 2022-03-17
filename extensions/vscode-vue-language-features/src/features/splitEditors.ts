import * as vscode from 'vscode';
import { ref, computed } from '@vue/reactivity';
import * as shared from '@volar/shared';
import { parse, SFCBlock } from '@vue/compiler-sfc';

export function activate(context: vscode.ExtensionContext) {

	const getDocDescriptor = useDocDescriptor();

	context.subscriptions.push(vscode.commands.registerCommand('volar.action.splitEditors', onSplit));

	async function onSplit() {

		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		const doc = editor.document;
		const { descriptor } = getDocDescriptor(doc.getText());
		const leftBlocks = [
			descriptor.scriptSetup,
			descriptor.script,
			...descriptor.styles,
		].filter(shared.notEmpty);
		const rightBlocks = [
			descriptor.template,
			...descriptor.customBlocks,
		].filter(shared.notEmpty);

		await foldingBlocks(leftBlocks);
		await vscode.commands.executeCommand('workbench.action.toggleSplitEditorInGroup');
		await foldingBlocks(rightBlocks);

		async function foldingBlocks(blocks: SFCBlock[]) {

			const firstBlock = blocks.sort((a, b) => a.loc.start.offset - b.loc.start.offset)[0];

			const editor = vscode.window.activeTextEditor;
			if (!editor) return;

			editor.selections = blocks.map(block => new vscode.Selection(doc.positionAt(block.loc.start.offset), doc.positionAt(block.loc.start.offset)));

			await vscode.commands.executeCommand('editor.unfoldAll');
			await vscode.commands.executeCommand('editor.foldLevel1');
			editor.revealRange(new vscode.Range(doc.positionAt(firstBlock.loc.start.offset), new vscode.Position(editor.document.lineCount, 0)), vscode.TextEditorRevealType.AtTop);
		}
	}
}

function useDocDescriptor() {

	const splitDocText = ref('');
	const splitDocDescriptor = computed(() => parse(splitDocText.value, { sourceMap: false, ignoreEmpty: false }));

	return getDescriptor;

	function getDescriptor(text: string) {
		splitDocText.value = text;
		return splitDocDescriptor.value;
	}
}

export function userPick(options: Record<string, vscode.QuickPickItem>, placeholder?: string) {
	return new Promise<string | undefined>(resolve => {
		const quickPick = vscode.window.createQuickPick();
		quickPick.items = Object.values(options);
		quickPick.placeholder = placeholder;
		quickPick.onDidChangeSelection(selection => {
			if (selection[0]) {
				for (let key in options) {
					const option = options[key];
					if (selection[0] === option) {
						resolve(key);
						quickPick.hide();
						break;
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
