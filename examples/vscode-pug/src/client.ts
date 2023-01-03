import { LanguageServerInitializationOptions, ServerMode, DiagnosticModel } from '@volar/language-server';
import * as path from 'typesafe-path';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';

let client: lsp.BaseLanguageClient;

export async function activate(context: vscode.ExtensionContext) {

	const documentSelector: lsp.DocumentFilter[] = [
		{ language: 'jade' },
	];
	const initializationOptions: LanguageServerInitializationOptions = {
		typescript: {
			tsdk: path.join(
				vscode.env.appRoot as path.OsPath,
				'extensions/node_modules/typescript/lib' as path.PosixPath,
			),
		},
		diagnosticModel: DiagnosticModel.Pull,
		serverMode: ServerMode.Syntactic, // avoid cross file behavior for better performance
		disableFileWatcher: true,
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
		'volar-pug-language-server',
		'Pug (Volar Example)',
		serverOptions,
		clientOptions,
	);
	await client.start();
}

export function deactivate(): Thenable<any> | undefined {
	return client?.stop();
}
