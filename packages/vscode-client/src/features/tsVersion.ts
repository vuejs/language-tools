import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { TsVersionChanged, UseWorkspaceTsdkChanged } from '@volar/shared';
import { userPick } from './splitEditors';

export async function activate(context: vscode.ExtensionContext, clients: LanguageClient[]) {

	for (const client of clients) {
		(async () => {
			await client.onReady();
			client.onNotification(TsVersionChanged.type, (newVersion) => {
				tsVersion = newVersion;
				updateStatusBar();
			});
		})();
	}

	let onVueDoc = false;
	let tsVersion: string | undefined;
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	statusBar.command = 'volar.selectTypeScriptVersion';

	context.subscriptions.push(vscode.commands.registerCommand('volar.selectTypeScriptVersion', async () => {
		const useWorkspaceTsdk = getUseWorkspaceTsdk(context);
		const options = new Map<boolean, string>();
		options.set(false, (!useWorkspaceTsdk ? '• ' : '') + "Use VS Code's Version");
		options.set(true, (useWorkspaceTsdk ? '• ' : '') + 'Use Workspace Version');

		const select = await userPick(options);
		if (select === undefined) return; // cancle

		if (select !== useWorkspaceTsdk) {
			setUseWorkspaceTsdk(context, select);
			for (const client of clients) {
				client.sendNotification(UseWorkspaceTsdkChanged.type, select);
			}
		}
	}));

	onChangeDocument(vscode.window.activeTextEditor?.document);
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => {
		onChangeDocument(e?.document);
	}));

	function updateStatusBar() {
		if (!onVueDoc && tsVersion) {
			statusBar.hide();
		}
		else {
			statusBar.text = 'TS ' + (tsVersion ?? 'loading...');
			statusBar.show();
		}
	}
	async function onChangeDocument(newDoc: vscode.TextDocument | undefined) {
		onVueDoc = newDoc?.languageId === 'vue';
		updateStatusBar();
	}
}

export function getUseWorkspaceTsdk(context: vscode.ExtensionContext) {
	return context.workspaceState.get('typescript.useWorkspaceTsdk', false);
}
export function setUseWorkspaceTsdk(context: vscode.ExtensionContext, value: boolean) {
	return context.workspaceState.update('typescript.useWorkspaceTsdk', value);
}
