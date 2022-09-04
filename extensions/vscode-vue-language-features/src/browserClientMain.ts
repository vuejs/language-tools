import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/browser';
import { activate as commonActivate, deactivate as commonDeactivate } from './common';

export function activate(context: vscode.ExtensionContext) {
	return commonActivate(context, async (
		id,
		name,
		documentSelector,
		initOptions,
	) => {

		const serverMain = vscode.Uri.joinPath(context.extensionUri, 'dist/browser/server.js');
		const worker = new Worker(serverMain.toString());
		const clientOptions: lsp.LanguageClientOptions = {
			documentSelector,
			initializationOptions: initOptions,
			progressOnInitialization: true,
			synchronize: {
				fileEvents: vscode.workspace.createFileSystemWatcher('{**/*.vue,**/*.md,**/*.html,**/*.js,**/*.jsx,**/*.ts,**/*.tsx,**/*.json}')
			}
		};
		const client = new lsp.LanguageClient(
			id,
			name,
			clientOptions,
			worker,
		);
		await client.start();

		return client;
	});
}

export function deactivate(): Thenable<any> | undefined {
	return commonDeactivate();
}
