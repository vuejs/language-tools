import * as vscode from 'vscode';
import { parse, SFCBlock } from '@vue/compiler-sfc';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.splitEditors', async _ => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        const doc = editor.document;
        const descriptor = parse(doc.getText()).descriptor;

        let blocks: SFCBlock[] = [];
        if (descriptor.scriptSetup) {
            blocks.push(descriptor.scriptSetup);
        }
        if (descriptor.script) {
            blocks.push(descriptor.script);
        }
        if (descriptor.template) {
            blocks.push(descriptor.template);
        }
        blocks = blocks.concat(descriptor.styles);
        blocks = blocks.concat(descriptor.customBlocks);

        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const pos = doc.positionAt(block.loc.start.offset);
            const _editor = i === 0 ? editor : await vscode.window.showTextDocument(doc.uri, {
                viewColumn: vscode.ViewColumn.Beside,
            });
            await vscode.commands.executeCommand('editor.unfoldAll');
            _editor.selection = new vscode.Selection(pos, pos);
            await vscode.commands.executeCommand('editor.foldLevel1');
        }
    }));
}
