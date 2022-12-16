import { LanguageServerInitializationOptions } from '@volar/language-server';
import * as path from 'typesafe-path';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';
import { registerShowVirtualFiles, registerTsConfig } from '@volar/vscode-language-client';

let client: lsp.BaseLanguageClient;

export async function activate(context: vscode.ExtensionContext) {

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
	};
	const serverModule = vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@volar-examples', 'angular-language-server', 'bin', 'angular-language-server.js');
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
		'Angular Language Server (Volar)',
		serverOptions,
		clientOptions,
	);
	await client.start();

	registerShowVirtualFiles('volar-angular.action.showVirtualFiles', context, client);
	registerTsConfig('volar-angular.action.showTsConfig', context, client, document => documentSelector.some(selector => selector.language === document.languageId));
}

export function deactivate(): Thenable<any> | undefined {
	return client?.stop();
}
