// import * as vscode from 'vscode';
// import * as lsp from 'vscode-languageclient/browser';
// import { activate as commonActivate, deactivate as commonDeactivate } from './common';

// export function activate(context: vscode.ExtensionContext) {
// 	return commonActivate(context, (
// 		id,
// 		name,
// 		documentSelector,
// 		initOptions,
// 	) => {

// 		const serverMain = vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@volar', 'server', 'browser');
// 		const worker = new Worker(serverMain.toString());
// 		const clientOptions: lsp.LanguageClientOptions = {
// 			documentSelector,
// 			initializationOptions: initOptions,
// 			synchronize: {
// 				fileEvents: vscode.workspace.createFileSystemWatcher('{**/*.vue,**/*.js,**/*.jsx,**/*.ts,**/*.tsx,**/*.json}')
// 			}
// 		};
// 		const client = new lsp.LanguageClient(
// 			id,
// 			name,
// 			clientOptions,
// 			worker,
// 		);
// 		context.subscriptions.push(client.start());

// 		return client;
// 	});
// }

// export function deactivate(): Thenable<any> | undefined {
// 	return commonDeactivate();
// }

console.log('Language features is not support yet.')
