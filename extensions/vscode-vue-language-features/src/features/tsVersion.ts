import * as path from 'path';
import * as vscode from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import { quickPick } from './splitEditors';
import { takeOverModeEnabled } from '../common';
import { InitializationOptions } from '@volar/vue-language-server';
import * as fs from 'fs';

const defaultTsdk = 'node_modules/typescript/lib';

export async function register(cmd: string, context: vscode.ExtensionContext, clients: BaseLanguageClient[]) {

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	statusBar.command = cmd;

	const subscription = vscode.commands.registerCommand(cmd, async () => {

		const usingWorkspaceTsdk = getCurrentTsdk(context).isWorkspacePath;
		const configTsdk = getConfigTsdk();
		const select = await quickPick([
			{
				'use_vscode_tsdk': {
					label: (!usingWorkspaceTsdk ? '• ' : '') + "Use VS Code's Version",
					description: getTsVersion(getVscodeTsdk()),
				},
				'use_workspace_tsdk': configTsdk ? {
					label: (usingWorkspaceTsdk ? '• ' : '') + 'Use Workspace Version',
					description: getTsVersion(resolveConfigTsdk(configTsdk)) ?? 'Could not load the TypeScript version at this path',
					detail: configTsdk,
				} : undefined,
				'use_workspace_tsdk_deafult': configTsdk !== defaultTsdk ? {
					label: (usingWorkspaceTsdk ? '• ' : '') + 'Use Workspace Version',
					description: getTsVersion(resolveConfigTsdk(defaultTsdk)) ?? 'Could not load the TypeScript version at this path',
					detail: defaultTsdk,
				} : undefined,
			},
			{
				'takeover': {
					label: 'What is Takeover Mode?',
				},
			}
		]);
		if (select === undefined) {
			return; // cancel
		}
		if (select === 'takeover') {
			vscode.env.openExternal(vscode.Uri.parse('https://vuejs.org/guide/typescript/overview.html#takeover-mode'));
			return;
		}
		if (select === 'use_workspace_tsdk_deafult') {
			vscode.workspace.getConfiguration('typescript').update('tsdk', defaultTsdk);
		}
		const shouldUseWorkspaceTsdk = select !== 'use_vscode_tsdk';
		if (shouldUseWorkspaceTsdk !== useWorkspaceTsdk(context)) {
			context.workspaceState.update('typescript.useWorkspaceTsdk', shouldUseWorkspaceTsdk);
			reloadServers();
		}
		updateStatusBar();
	});
	context.subscriptions.push(subscription);

	let tsdk = getConfigTsdk();
	vscode.workspace.onDidChangeConfiguration(() => {
		const newTsdk = getConfigTsdk();
		if (newTsdk !== tsdk) {
			tsdk = newTsdk;
			if (useWorkspaceTsdk(context)) {
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
			const tsVersion = getTsVersion(getCurrentTsdk(context).tsdk);
			statusBar.text = '' + tsVersion;
			if (takeOverModeEnabled()) {
				statusBar.text += ' (takeover)';
			}
			statusBar.show();
		}
	}
	async function reloadServers() {
		const tsPaths = getCurrentTsdk(context);
		for (const client of clients) {
			const newInitOptions: InitializationOptions = {
				...client.clientOptions.initializationOptions,
				typescript: tsPaths,
			};
			client.clientOptions.initializationOptions = newInitOptions;
		}
		vscode.commands.executeCommand('volar.action.restartServer');
	}
}

export function getCurrentTsdk(context: vscode.ExtensionContext) {
	if (useWorkspaceTsdk(context)) {
		const resolvedTsdk = resolveConfigTsdk(getConfigTsdk() ?? defaultTsdk);
		if (resolvedTsdk) {
			return { tsdk: resolvedTsdk, isWorkspacePath: true };
		}
	}
	return { tsdk: getVscodeTsdk(), isWorkspacePath: false };
}

function resolveConfigTsdk(tsdk: string) {
	if (path.isAbsolute(tsdk)) {
		return tsdk;
	}
	const workspaceFolderFsPaths = (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath);
	for (const folder of workspaceFolderFsPaths) {
		const _path = path.join(folder, tsdk);
		if (fs.existsSync(_path)) {
			return _path;
		}
	}
}

function getVscodeTsdk() {
	const nightly = vscode.extensions.getExtension('ms-vscode.vscode-typescript-next');
	if (nightly) {
		return path.join(nightly.extensionPath, 'node_modules/typescript/lib');
	}
	return path.join(vscode.env.appRoot, 'extensions', 'node_modules', 'typescript', 'lib');
}

function getConfigTsdk() {
	return vscode.workspace.getConfiguration('typescript').get<string>('tsdk');
}

function useWorkspaceTsdk(context: vscode.ExtensionContext) {
	return context.workspaceState.get('typescript.useWorkspaceTsdk', false);
}

export function getTsVersion(libPath: string | undefined): string | undefined {
	if (!libPath || !fs.existsSync(libPath)) {
		return undefined;
	}

	const p = libPath.split(path.sep);
	if (p.length <= 1) {
		return undefined;
	}
	const p2 = p.slice(0, -1);
	const modulePath = p2.join(path.sep);
	let fileName = path.join(modulePath, 'package.json');
	if (!fs.existsSync(fileName)) {
		// Special case for ts dev versions
		if (path.basename(modulePath) === 'built') {
			fileName = path.join(modulePath, '..', 'package.json');
		}
	}
	if (!fs.existsSync(fileName)) {
		return undefined;
	}

	const contents = fs.readFileSync(fileName).toString();
	let desc: any = null;
	try {
		desc = JSON.parse(contents);
	} catch (err) {
		return undefined;
	}
	if (!desc || !desc.version) {
		return undefined;
	}
	return desc.version;
}
