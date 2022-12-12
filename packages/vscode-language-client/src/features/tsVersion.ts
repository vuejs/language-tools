import * as path from 'typesafe-path';
import * as vscode from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import { quickPick } from '../common';
import { LanguageServerInitializationOptions } from '@volar/language-server';
import * as shared from '@volar/shared';

const defaultTsdkPath = 'node_modules/typescript/lib' as path.PosixPath;

export async function register(
	cmd: string,
	context: vscode.ExtensionContext,
	client: BaseLanguageClient,
	shouldStatusBarShow: (document: vscode.TextDocument) => boolean,
	takeOverModeEnabled: () => boolean,
	noProjectReferences: () => boolean,
) {

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	statusBar.command = cmd;

	context.subscriptions.push({ dispose: () => statusBar.dispose() });
	context.subscriptions.push(vscode.commands.registerCommand(cmd, onCommand));

	vscode.workspace.onDidChangeConfiguration(onDidChangeConfiguration, undefined, context.subscriptions);
	vscode.window.onDidChangeActiveTextEditor(updateStatusBar, undefined, context.subscriptions);

	updateStatusBar();

	async function onCommand() {

		const tsdk = getTsdk(context);
		const configTsdkPath = getConfigTsdkPath();
		const vscodeTsdkUri = getVScodeTsdkUri();
		const isWeb = vscodeTsdkUri.scheme !== 'file';
		const select = await quickPick([
			{
				useVSCodeTsdk: {
					label: (!tsdk.isWorkspacePath ? '• ' : '') + "Use VS Code's Version",
					description: await getTsVersion(vscodeTsdkUri),
					detail: isWeb ? vscodeTsdkUri.toString(true) : undefined,
				},
				useConfigWorkspaceTsdk: configTsdkPath && !isWeb ? {
					label: (tsdk.isWorkspacePath ? '• ' : '') + 'Use Workspace Version',
					description: await getTsVersion(vscode.Uri.file(resolveWorkspaceTsdk(configTsdkPath) ?? '/')) ?? 'Could not load the TypeScript version at this path',
					detail: configTsdkPath,
				} : undefined,
				useDefaultWorkspaceTsdk: configTsdkPath !== defaultTsdkPath && !isWeb ? {
					label: (tsdk.isWorkspacePath ? '• ' : '') + 'Use Workspace Version',
					description: await getTsVersion(vscode.Uri.file(resolveWorkspaceTsdk(defaultTsdkPath) ?? '/')) ?? 'Could not load the TypeScript version at this path',
					detail: defaultTsdkPath,
				} : undefined,
			},
			{
				takeover: takeOverModeEnabled() ? {
					label: 'What is Takeover Mode?',
				} : undefined,
			}
		]);

		if (select === undefined) {
			return; // cancel
		}
		if (select === 'takeover') {
			vscode.env.openExternal(vscode.Uri.parse('https://vuejs.org/guide/typescript/overview.html#volar-takeover-mode'));
			return;
		}
		if (select === 'useDefaultWorkspaceTsdk') {
			await vscode.workspace.getConfiguration('typescript').update('tsdk', defaultTsdkPath);
		}
		const useWorkspaceTsdk = select === 'useConfigWorkspaceTsdk' || select === 'useDefaultWorkspaceTsdk';
		if (useWorkspaceTsdk !== isUseWorkspaceTsdk(context)) {
			context.workspaceState.update('typescript.useWorkspaceTsdk', useWorkspaceTsdk);
			reloadServers();
		}
		updateStatusBar();
	}

	function onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
		if (e.affectsConfiguration('typescript.tsdk') && isUseWorkspaceTsdk(context)) {
			reloadServers();
		}
	}

	async function updateStatusBar() {
		if (
			!vscode.window.activeTextEditor
			|| !shouldStatusBarShow(vscode.window.activeTextEditor.document)
		) {
			statusBar.hide();
		}
		else {
			const tsVersion = await getTsVersion(getTsdk(context).uri);
			statusBar.text = tsVersion ?? 'x.x.x';
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
		const tsPaths = getTsdk(context);
		const newInitOptions: LanguageServerInitializationOptions = {
			...client.clientOptions.initializationOptions,
			typescript: tsPaths,
		};
		client.clientOptions.initializationOptions = newInitOptions;
		vscode.commands.executeCommand('volar.action.restartServer');
	}
}

export function getTsdk(context: vscode.ExtensionContext) {
	if (isUseWorkspaceTsdk(context)) {
		const resolvedTsdk = resolveWorkspaceTsdk(getConfigTsdkPath() || defaultTsdkPath);
		if (resolvedTsdk) {
			return {
				tsdk: resolvedTsdk,
				uri: vscode.Uri.file(resolvedTsdk),
				isWorkspacePath: true,
			};
		}
	}
	const vscodeTsdkUri = getVScodeTsdkUri();
	return {
		tsdk: shared.getPathOfUri(vscodeTsdkUri.toString()),
		uri: vscodeTsdkUri,
		isWorkspacePath: false,
	};
}

function resolveWorkspaceTsdk(tsdk: path.OsPath | path.PosixPath) {
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

function getVScodeTsdkUri() {

	const nightly = vscode.extensions.getExtension('ms-vscode.vscode-typescript-next');
	if (nightly) {
		return vscode.Uri.parse(nightly.extensionUri.toString() + '/node_modules/typescript/lib');
	}

	if (vscode.env.appRoot) {
		return vscode.Uri.file(path.join(
			vscode.env.appRoot as path.OsPath,
			'extensions/node_modules/typescript/lib' as path.PosixPath,
		));
	}

	// web
	const version = require('typescript/package.json').version;
	return vscode.Uri.parse(`https://cdn.jsdelivr.net/npm/typescript@${version}/lib`);
}

function getConfigTsdkPath() {
	return vscode.workspace.getConfiguration('typescript').get<path.PosixPath>('tsdk');
}

function isUseWorkspaceTsdk(context: vscode.ExtensionContext) {
	return context.workspaceState.get('typescript.useWorkspaceTsdk', false);
}

async function getTsVersion(libUri: vscode.Uri): Promise<string | undefined> {

	const isWeb = libUri.scheme !== 'file';

	if (isWeb) {
		return require('typescript/package.json').version;
	}

	const p = libUri.toString().split('/');
	const p2 = p.slice(0, -1);
	const moduleUri = p2.join('/');
	const fileUri = vscode.Uri.parse(moduleUri + '/package.json');
	const contents = await readFile(fileUri);

	if (contents === undefined) {
		return;
	}

	let desc: any = null;
	try {
		desc = JSON.parse(contents);
	} catch (err) {
		return;
	}
	if (!desc || !desc.version) {
		return;
	}

	return desc.version;
}

async function readFile(uri: vscode.Uri) {
	try {
		const data = await vscode.workspace.fs.readFile(uri);
		return new TextDecoder('utf8').decode(data);
	}
	catch { }
}
