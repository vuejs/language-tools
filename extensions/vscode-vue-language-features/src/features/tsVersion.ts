import * as path from 'typesafe-path';
import * as vscode from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import { quickPick } from './splitEditors';
import { noProjectReferences, takeOverModeEnabled } from '../common';
import { LanguageServerInitializationOptions } from '@volar/vue-language-server';
import * as fs from 'fs';

const defaultTsdk = 'node_modules/typescript/lib' as path.PosixPath;

export async function register(cmd: string, context: vscode.ExtensionContext, client: BaseLanguageClient) {

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
				'use_workspace_tsdk_default': configTsdk !== defaultTsdk ? {
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
			vscode.env.openExternal(vscode.Uri.parse('https://vuejs.org/guide/typescript/overview.html#volar-takeover-mode'));
			return;
		}
		if (select === 'use_workspace_tsdk_default') {
			await vscode.workspace.getConfiguration('typescript').update('tsdk', defaultTsdk);
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
			if (noProjectReferences()) {
				statusBar.text += ' (noProjectReferences)';
			}
			statusBar.show();
		}
	}
	async function reloadServers() {
		const tsPaths = getCurrentTsdk(context);
		const newInitOptions: LanguageServerInitializationOptions = {
			...client.clientOptions.initializationOptions,
			typescript: tsPaths,
		};
		client.clientOptions.initializationOptions = newInitOptions;
		vscode.commands.executeCommand('volar.action.restartServer');
	}
}

export function getCurrentTsdk(context: vscode.ExtensionContext) {
	if (useWorkspaceTsdk(context)) {
		const resolvedTsdk = resolveConfigTsdk(getConfigTsdk() || defaultTsdk);
		if (resolvedTsdk) {
			return { tsdk: resolvedTsdk, isWorkspacePath: true };
		}
	}
	return { tsdk: getVscodeTsdk(), isWorkspacePath: false };
}

function resolveConfigTsdk(tsdk: path.OsPath | path.PosixPath) {
	if (path.isAbsolute(tsdk)) {
		try {
			if (require.resolve('./typescript.js', { paths: [tsdk] })) {
				return tsdk;
			}
		} catch { }
	}
	const workspaceFolderFsPaths = (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath as path.OsPath);
	for (const folder of workspaceFolderFsPaths) {
		const _path = path.join(folder, tsdk);
		try {
			if (require.resolve('./typescript.js', { paths: [_path] })) {
				return _path;
			}
		} catch { }
	}
}

function getVscodeTsdk() {
	const nightly = vscode.extensions.getExtension('ms-vscode.vscode-typescript-next');
	if (nightly) {
		return path.join(
			nightly.extensionPath as path.OsPath,
			'node_modules/typescript/lib' as path.PosixPath,
		);
	}
	return path.join(
		vscode.env.appRoot as path.OsPath,
		'extensions/node_modules/typescript/lib' as path.PosixPath,
	);
}

function getConfigTsdk() {
	return vscode.workspace.getConfiguration('typescript').get<path.PosixPath>('tsdk') ?? '';
}

function useWorkspaceTsdk(context: vscode.ExtensionContext) {
	return context.workspaceState.get('typescript.useWorkspaceTsdk', false);
}

export function getTsVersion(libPath: path.OsPath | path.PosixPath | undefined): string | undefined {
	if (!libPath || !fs.existsSync(libPath)) {
		return undefined;
	}

	const p = libPath.split(path.sep);
	if (p.length <= 1) {
		return undefined;
	}
	const p2 = p.slice(0, -1);
	const modulePath = p2.join(path.sep) as path.OsPath;
	let fileName = path.join(modulePath, 'package.json' as path.PosixPath);
	if (!fs.existsSync(fileName)) {
		// Special case for ts dev versions
		if (path.basename(modulePath) === 'built') {
			fileName = path.join(modulePath, '../package.json' as path.PosixPath);
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
