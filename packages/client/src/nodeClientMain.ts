import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';
import { activate as commonActivate, deactivate as commonDeactivate } from './common';

export function activate(context: vscode.ExtensionContext) {
	return commonActivate(context, (
		id,
		name,
		documentSelector,
		initOptions,
		port,
	) => {

		const serverModule = vscode.Uri.joinPath(context.extensionUri, 'out', 'server-node');
		const debugOptions = { execArgv: ['--nolazy', '--inspect=' + port] };
		const serverOptions: lsp.ServerOptions = {
			run: { module: serverModule.fsPath, transport: lsp.TransportKind.ipc },
			debug: {
				module: serverModule.fsPath,
				transport: lsp.TransportKind.ipc,
				options: debugOptions
			},
		};
		const clientOptions: lsp.LanguageClientOptions = {
			documentSelector,
			initializationOptions: initOptions,
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
		context.subscriptions.push(client.start());
	
		return client;
	});
}

export function deactivate(): Thenable<any> | undefined {
	return commonDeactivate();
}
