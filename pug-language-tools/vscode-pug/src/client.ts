import { LanguageServerInitializationOptions, DiagnosticModel } from '@volar/language-server';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';

let client: lsp.BaseLanguageClient;

export async function activate(context: vscode.ExtensionContext) {

	const initializationOptions: LanguageServerInitializationOptions = {
		diagnosticModel: DiagnosticModel.Pull, // not matter because pug diagnostic is very fast
		disableFileWatcher: true, // don't care about file changes
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
		documentSelector: [{ language: 'jade' }],
		initializationOptions,
	};
	client = new lsp.LanguageClient(
		'volar-pug-language-server',
		'Pug (Volar)',
		serverOptions,
		clientOptions,
	);
	await client.start();
}

export function deactivate(): Thenable<any> | undefined {
	return client?.stop();
}
