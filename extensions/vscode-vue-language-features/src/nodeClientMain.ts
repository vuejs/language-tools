import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';
import { activate as commonActivate, deactivate as commonDeactivate } from './common';

export function activate(context: vscode.ExtensionContext) {
	return commonActivate(context, async (
		id,
		name,
		documentSelector,
		initOptions,
		port,
	) => {

		const serverModule = vscode.Uri.joinPath(context.extensionUri, 'server');
		const maxOldSpaceSize = vscode.workspace.getConfiguration('volar').get<number | null>('vueserver.maxOldSpaceSize');
		const runOptions = { execArgv: <string[]>[] };
		if (maxOldSpaceSize) {
			runOptions.execArgv.push("--max-old-space-size=" + maxOldSpaceSize);
		}
		const debugOptions = { execArgv: ['--nolazy', '--inspect=' + port] };
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
			initializationOptions: initOptions,
			progressOnInitialization: true,
			synchronize: {
				fileEvents: vscode.workspace.createFileSystemWatcher('{**/*.vue,**/*.js,**/*.jsx,**/*.ts,**/*.tsx,**/*.json}')
			}
		};
		const client = new lsp.LanguageClient(
			id,
			name,
			serverOptions,
			clientOptions,
		);
		await client.start();

		return client;
	});
}

export function deactivate(): Thenable<any> | undefined {
	return commonDeactivate();
}
