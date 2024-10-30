import { ExecuteCommandParams, ExecuteCommandRequest, type BaseLanguageClient } from '@volar/vscode';
import type { SFCParseResult } from '@vue/language-server';
import { commands } from '@vue/language-server/lib/types';
import { executeCommand, useActiveTextEditor, useCommand } from 'reactive-vscode';
import * as vscode from 'vscode';
import { config } from '../config';

type SFCBlock = SFCParseResult['descriptor']['customBlocks'][number];

export function activate(client: BaseLanguageClient) {

	const activeTextEditor = useActiveTextEditor();
	const getDocDescriptor = useDocDescriptor(client);

	useCommand('vue.action.splitEditors', async () => {
		const editor = activeTextEditor.value;
		if (!editor) {
			return;
		}

		const layout = config.splitEditors.layout;
		const doc = editor.document;
		const descriptor = (await getDocDescriptor(doc.getText()))?.descriptor;
		if (!descriptor) {
			return;
		}

		let leftBlocks: SFCBlock[] = [];
		let rightBlocks: SFCBlock[] = [];

		if (descriptor.script) {
			if (layout.left.includes('script')) {
				leftBlocks.push(descriptor.script);
			}
			if (layout.right.includes('script')) {
				rightBlocks.push(descriptor.script);
			}
		}
		if (descriptor.scriptSetup) {
			if (layout.left.includes('scriptSetup')) {
				leftBlocks.push(descriptor.scriptSetup);
			}
			if (layout.right.includes('scriptSetup')) {
				rightBlocks.push(descriptor.scriptSetup);
			}
		}
		if (descriptor.template) {
			if (layout.left.includes('template')) {
				leftBlocks.push(descriptor.template);
			}
			if (layout.right.includes('template')) {
				rightBlocks.push(descriptor.template);
			}
		}
		if (layout.left.includes('styles')) {
			leftBlocks = leftBlocks.concat(descriptor.styles);
		}
		if (layout.right.includes('styles')) {
			rightBlocks = rightBlocks.concat(descriptor.styles);
		}
		if (layout.left.includes('customBlocks')) {
			leftBlocks = leftBlocks.concat(descriptor.customBlocks);
		}
		if (layout.right.includes('customBlocks')) {
			rightBlocks = rightBlocks.concat(descriptor.customBlocks);
		}

		await executeCommand('workbench.action.joinEditorInGroup');

		if (activeTextEditor.value === editor) {
			await foldingBlocks(leftBlocks);
			await executeCommand('workbench.action.toggleSplitEditorInGroup');
			await foldingBlocks(rightBlocks);
		}
		else {
			await executeCommand('editor.unfoldAll');
		}

		async function foldingBlocks(blocks: SFCBlock[]) {

			const editor = activeTextEditor.value;
			if (!editor) {
				return;
			}

			editor.selections = blocks.length
				? blocks.map(block => new vscode.Selection(doc.positionAt(block.loc.start.offset), doc.positionAt(block.loc.start.offset)))
				: [new vscode.Selection(doc.positionAt(doc.getText().length), doc.positionAt(doc.getText().length))];

			await executeCommand('editor.unfoldAll');
			await executeCommand('editor.foldLevel1');

			const firstBlock = blocks.sort((a, b) => a.loc.start.offset - b.loc.start.offset)[0];
			if (firstBlock) {
				editor.revealRange(new vscode.Range(doc.positionAt(firstBlock.loc.start.offset), new vscode.Position(editor.document.lineCount, 0)), vscode.TextEditorRevealType.AtTop);
			}
		}
	});
}

export function useDocDescriptor(client: BaseLanguageClient) {

	let splitDocText: string | undefined;
	let splitDocDescriptor: SFCParseResult | undefined;

	return getDescriptor;

	async function getDescriptor(text: string) {
		if (text !== splitDocText) {
			splitDocText = text;
			splitDocDescriptor = await client.sendRequest(ExecuteCommandRequest.type, {
				command: commands.parseSfc,
				arguments: [text],
			} satisfies ExecuteCommandParams);
		}
		return splitDocDescriptor;
	}
}
