import * as vscode from 'vscode';
import { parse, SFCBlock } from '@vue/compiler-sfc';
import { notEmpty } from '@volar/shared';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.splitEditors', async _ => {

        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const doc = editor.document;
        const descriptor = parse(doc.getText()).descriptor;
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
            if (!editor) {
                continue;
            }
            await vscode.commands.executeCommand('editor.unfoldAll');
            editor.selections = blocks.map(block => new vscode.Selection(doc.positionAt(block.loc.start.offset), doc.positionAt(block.loc.start.offset)));
            await vscode.commands.executeCommand('editor.foldLevel1');
            editor.revealRange(new vscode.Range(doc.positionAt(firstBlock.loc.start.offset), new vscode.Position(editor.document.lineCount, 0)), vscode.TextEditorRevealType.AtTop);
        }
    }));
}
