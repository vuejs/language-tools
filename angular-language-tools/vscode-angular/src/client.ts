import type { LanguageServerInitializationOptions } from '@volar/language-server';
import * as path from 'typesafe-path';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';
import {
	registerShowVirtualFiles,
	registerTsConfig,
	registerTsVersion,
	takeOverModeActive,
} from '@volar/vscode-language-client';
import * as os from 'os';
import * as fs from 'fs';

let client: lsp.BaseLanguageClient;

export async function activate(context: vscode.ExtensionContext) {

	const stopCheck = vscode.window.onDidChangeActiveTextEditor(tryActivate);
	tryActivate();

	function tryActivate() {

		if (!vscode.window.activeTextEditor) {
			return;
		}

		const currentLangId = vscode.window.activeTextEditor.document.languageId;
		const takeOverMode = takeOverModeActive(context);
		if (takeOverMode && ['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'html'].includes(currentLangId)) {
			doActivate(context);
			stopCheck.dispose();
		}
	}
}

async function doActivate(context: vscode.ExtensionContext) {

	const cancellationPipeName = path.join(os.tmpdir() as path.OsPath, `vscode-${context.extension.id}-cancellation-pipe.tmp` as path.PosixPath);
	const isSupportDoc = (document: vscode.TextDocument) => documentSelector.some(selector => selector.language === document.languageId);
	let cancellationPipeUpdateKey: string | undefined;

	vscode.workspace.onDidChangeTextDocument((e) => {
		let key = e.document.uri.toString() + '|' + e.document.version;
		if (cancellationPipeUpdateKey === undefined) {
			cancellationPipeUpdateKey = key;
			return;
		}
		if (isSupportDoc(e.document) && cancellationPipeUpdateKey !== key) {
			cancellationPipeUpdateKey = key;
			fs.writeFileSync(cancellationPipeName, '');
		}
	});

	const documentSelector: lsp.DocumentFilter[] = [
		{ language: 'html' },
		{ language: 'typescript' },
	];
	const initializationOptions: LanguageServerInitializationOptions = {
		typescript: {
			tsdk: path.join(
				vscode.env.appRoot as path.OsPath,
				'extensions/node_modules/typescript/lib' as path.PosixPath,
			),
		},
		cancellationPipeName,
		noProjectReferences: true,
	};
	const serverModule = vscode.Uri.joinPath(context.extensionUri, 'server.js');
	const runOptions = { execArgv: <string[]>[] };
	const debugOptions = { execArgv: ['--nolazy', '--inspect=' + 6009] };
	const serverOptions: lsp.ServerOptions = {
		run: {
			module: serverModule.fsPath,
			transport: lsp.TransportKind.ipc,
			options: runOptions
		},
		debug: {
			module: serverModule.fsPath,
			transport: lsp.TransportKind.ipc,
			options: debugOptions
		},
	};
	const clientOptions: lsp.LanguageClientOptions = {
		documentSelector,
		initializationOptions,
	};
	client = new lsp.LanguageClient(
		'volar-angular-language-server',
		'Angular (Volar Example)',
		serverOptions,
		clientOptions,
	);
	await client.start();

	registerShowVirtualFiles('volar-angular.action.showVirtualFiles', context, client);
	registerTsConfig('volar-angular.action.showTsConfig', context, client, isSupportDoc);
	registerTsVersion('volar-angular.action.showTsVersion', context, client, isSupportDoc, text => text + ' (angular)');
}

export function deactivate(): Thenable<any> | undefined {
	return client?.stop();
}
