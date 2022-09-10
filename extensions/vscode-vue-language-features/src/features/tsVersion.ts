import * as path from 'path';
import * as vscode from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import * as shared from '@volar/shared';
import { userPick } from './splitEditors';
import { takeOverModeEnabled } from '../common';
import { ServerInitializationOptions } from '@volar/vue-language-server';

const defaultTsdk = 'node_modules/typescript/lib';

export async function register(cmd: string, context: vscode.ExtensionContext, clients: BaseLanguageClient[]) {

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	statusBar.command = cmd;

	const subscription = vscode.commands.registerCommand(cmd, async () => {

		const useWorkspaceTsdk = getCurrentTsPaths(context).isWorkspacePath;
		const workspaceTsPaths = getWorkspaceTsPaths();
		const workspaceTsVersion = workspaceTsPaths ? shared.getTypeScriptVersion(workspaceTsPaths.serverPath) : undefined;
		const vscodeTsPaths = getVscodeTsPaths();
		const vscodeTsVersion = shared.getTypeScriptVersion(vscodeTsPaths.serverPath);
		const tsdk = getTsdk();
		const defaultTsServer = shared.getWorkspaceTypescriptPath(defaultTsdk, (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath));
		const defaultTsVersion = defaultTsServer ? shared.getTypeScriptVersion(defaultTsServer) : undefined;

		const options: Record<string, vscode.QuickPickItem> = {};
		options[0] = {
			label: (!useWorkspaceTsdk ? '• ' : '') + "Use VS Code's Version",
			description: vscodeTsVersion,
		};
		if (tsdk) {
			options[1] = {
				label: (useWorkspaceTsdk ? '• ' : '') + 'Use Workspace Version',
				description: workspaceTsVersion ?? 'Could not load the TypeScript version at this path',
				detail: tsdk,
			};
		}
		if (tsdk !== defaultTsdk) {
			options[2] = {
				label: (useWorkspaceTsdk ? '• ' : '') + 'Use Workspace Version',
				description: defaultTsVersion ?? 'Could not load the TypeScript version at this path',
				detail: defaultTsdk,
			};
		}
		if (takeOverModeEnabled()) {
			options[3] = {
				label: 'What is Takeover Mode?',
			};
		}

		const select = await userPick(options);
		if (select === undefined)
			return; // cancel

		if (select === '3') {
			vscode.env.openExternal(vscode.Uri.parse('https://vuejs.org/guide/typescript/overview.html#takeover-mode'));
			return;
		}

		if (select === '2') {
			vscode.workspace.getConfiguration('typescript').update('tsdk', defaultTsdk);
		}

		const nowUseWorkspaceTsdk = select !== '0';
		if (nowUseWorkspaceTsdk !== isUseWorkspaceTsdk(context)) {
			context.workspaceState.update('typescript.useWorkspaceTsdk', nowUseWorkspaceTsdk);
			reloadServers();
		}

		updateStatusBar();
	});
	context.subscriptions.push(subscription);

	let tsdk = getTsdk();
	vscode.workspace.onDidChangeConfiguration(() => {
		const newTsdk = getTsdk();
		if (newTsdk !== tsdk) {
			tsdk = newTsdk;
			if (isUseWorkspaceTsdk(context)) {
				reloadServers();
			}
		}
	});

	updateStatusBar();
	vscode.window.onDidChangeActiveTextEditor(updateStatusBar, undefined, context.subscriptions);

	function updateStatusBar() {
		if (
			vscode.window.activeTextEditor?.document.languageId !== 'vue'
			&& vscode.window.activeTextEditor?.document.languageId !== 'markdown'
			&& vscode.window.activeTextEditor?.document.languageId !== 'html'
			&& !(
				takeOverModeEnabled()
				&& vscode.window.activeTextEditor
				&& ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(vscode.window.activeTextEditor.document.languageId)
			)
		) {
			statusBar.hide();
		}
		else {
			const tsPaths = getCurrentTsPaths(context);
			const tsVersion = shared.getTypeScriptVersion(tsPaths.serverPath);
			statusBar.text = 'TS ' + tsVersion;
			if (takeOverModeEnabled()) {
				statusBar.text += ' (takeover)';
			}
			statusBar.show();
		}
	}
	async function reloadServers() {
		const tsPaths = getCurrentTsPaths(context);
		for (const client of clients) {
			const newInitOptions: ServerInitializationOptions = {
				...client.clientOptions.initializationOptions,
				typescript: tsPaths,
			};
			client.clientOptions.initializationOptions = newInitOptions;
		}
		vscode.commands.executeCommand('volar.action.restartServer');
	}
}

export function getCurrentTsPaths(context: vscode.ExtensionContext) {
	if (isUseWorkspaceTsdk(context)) {
		const workspaceTsPaths = getWorkspaceTsPaths(true);
		if (workspaceTsPaths) {
			return { ...workspaceTsPaths, isWorkspacePath: true };
		}
	}
	return { ...getVscodeTsPaths(), isWorkspacePath: false };
}

function getWorkspaceTsPaths(useDefault = false) {
	let tsdk = getTsdk();
	if (!tsdk && useDefault) {
		tsdk = defaultTsdk;
	}
	if (tsdk) {
		const fsPaths = (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath);
		const tsPath = shared.getWorkspaceTypescriptPath(tsdk, fsPaths);
		if (tsPath) {
			return {
				serverPath: tsPath,
				localizedPath: shared.getWorkspaceTypescriptLocalizedPath(tsdk, vscode.env.language, fsPaths),
			};
		}
	}
}

function getVscodeTsPaths() {
	const nightly = vscode.extensions.getExtension('ms-vscode.vscode-typescript-next');
	if (nightly) {
		const tsLibPath = path.join(nightly.extensionPath, 'node_modules/typescript/lib');
		const serverPath = shared.findTypescriptModulePathInLib(tsLibPath);
		if (serverPath) {
			return {
				serverPath,
				localizedPath: shared.findTypescriptLocalizedPathInLib(tsLibPath, vscode.env.language)
			};
		}
	}
	return {
		serverPath: shared.getVscodeTypescriptPath(vscode.env.appRoot),
		localizedPath: shared.getVscodeTypescriptLocalizedPath(vscode.env.appRoot, vscode.env.language),
	};
}

function getTsdk() {
	const tsConfigs = vscode.workspace.getConfiguration('typescript');
	const tsdk = tsConfigs.get<string>('tsdk');
	return tsdk;
}

function isUseWorkspaceTsdk(context: vscode.ExtensionContext) {
	return context.workspaceState.get('typescript.useWorkspaceTsdk', false);
}
