import * as vscode from 'vscode';
import { parse, SFCBlock } from '@vue/compiler-sfc';
import { ref, computed } from '@vue/reactivity';
import * as shared from '@volar/shared';

export function activate(context: vscode.ExtensionContext) {

	const getDocDescriptor = useDocDescriptor();

	context.subscriptions.push(vscode.commands.registerCommand('volar.action.splitEditors', onSplit));

	async function onSplit() {

		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		const doc = editor.document;
		const descriptor = getDocDescriptor(doc.getText());
		const blocksSet: SFCBlock[][] = [];

		if (descriptor.scriptSetup || descriptor.script) {
			blocksSet.push([descriptor.scriptSetup, descriptor.script].filter(shared.notEmpty));
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

		const startViewColumn = vscode.window.activeTextEditor?.viewColumn;
		if (startViewColumn === undefined)
			return;

		await splitCurrentEditors(blocksSet.length);
		for (let i = 0; i < blocksSet.length; i++) {

			const blocks = blocksSet[i];
			const firstBlock = blocks.sort((a, b) => a.loc.start.offset - b.loc.start.offset)[0];

			const editor = await vscode.window.showTextDocument(doc, startViewColumn + i);
			editor.selections = blocks.map(block => new vscode.Selection(doc.positionAt(block.loc.start.offset), doc.positionAt(block.loc.start.offset)));

			await vscode.commands.executeCommand('editor.foldLevel1');
			editor.revealRange(new vscode.Range(doc.positionAt(firstBlock.loc.start.offset), new vscode.Position(editor.document.lineCount, 0)), vscode.TextEditorRevealType.AtTop);
		}
	}
}

async function splitCurrentEditors(num: number) {

	const actions: ReturnType<typeof vscode.commands.executeCommand>[] = [];

	await vscode.commands.executeCommand('editor.unfoldAll');

	for (let i = 1; i < num; i++) {
		if (i % 2 === 1) {
			actions.push(vscode.commands.executeCommand('workbench.action.splitEditorRight'));
		}
		if (i % 2 === 0) {
			actions.push(vscode.commands.executeCommand('workbench.action.splitEditorDown'));
		}
	}

	await Promise.all(actions);
}

function useDocDescriptor() {

	const splitDocText = ref('');
	const splitDocDescriptor = computed(() => parse(splitDocText.value, { sourceMap: false, ignoreEmpty: false }).descriptor);

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
