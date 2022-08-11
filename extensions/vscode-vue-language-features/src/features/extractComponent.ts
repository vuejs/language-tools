import * as vscode from 'vscode';
import * as path from 'path';
import { parse } from 'vue/compiler-sfc';

/**
 * Extracts selected text into new sfc
 */

export async function register(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.extractComponent', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		const selection = editor.selection;
		const document = editor.document;
		const selectedText = document.getText(selection);
		if (!selectedText) {
			vscode.window.showErrorMessage('No text selected.');
			return;
		}
		let componentName = await vscode.window.showInputBox({
			prompt: 'Component name: ',
			placeHolder: 'NewComponent'
		});
		// user cancelled
		if (componentName === undefined) {
			return;
		}
		if (componentName.length === 0) {
			componentName = 'ExtractedComponent';
		}
		const componentFilename = componentName + '.vue';
		const uri = document.uri.fsPath;
		const dirname = path.dirname(uri);
		const componentPath = path.join(dirname, componentFilename);
		const componentUri = vscode.Uri.file(componentPath);
		const workspaceEdit = new vscode.WorkspaceEdit();
		workspaceEdit.createFile(componentUri, { overwrite: true });
		const vueSfc = parse(document.getText());
		const scriptSetup = vueSfc.descriptor.scriptSetup;
		const script = vueSfc.descriptor.script;
		const isTypescript = scriptSetup?.lang === 'ts' || script?.lang === 'ts';
		const langAttribute = isTypescript ? 'lang="ts"' : undefined;
		let fileContent = `<template>
${selectedText}
</template>
`;
		if (scriptSetup) {
			fileContent += `
<script setup ${langAttribute}>

</script>		
`;
		}
		else {
			fileContent += `
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
	name: '${componentName}'
})
</script>
`;
		}
		const contentBytes = Buffer.from(fileContent, 'utf-8');
		vscode.workspace.fs.writeFile(componentUri, contentBytes);
	}));
}


