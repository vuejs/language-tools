import { LanguageServerInitializationOptions } from '@volar/language-server';
import * as path from 'typesafe-path';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';
import * as virtualFiles from '../../../extensions/vscode-vue-language-features/out/features/virtualFiles';

let client: lsp.BaseLanguageClient;

export async function activate(context: vscode.ExtensionContext) {

	const documentSelector: lsp.DocumentSelector = [{ language: 'svelte' }];
	const initializationOptions: LanguageServerInitializationOptions = {
		typescript: {
			tsdk: path.join(
				vscode.env.appRoot as path.OsPath,
				'extensions/node_modules/typescript/lib' as path.PosixPath,
			),
		},
	};
	const serverModule = vscode.Uri.joinPath(context.extensionUri, 'out', 'server');
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
		synchronize: {
			fileEvents: vscode.workspace.createFileSystemWatcher('{**/*.svelte,**/*.js,**/*.jsx,**/*.ts,**/*.tsx,**/*.json}')
		},
		middleware: {
			workspace: {
				configuration(params, token, next) {
					if (params.items.length === 1 && params.items[0].section === 'volar.format.initialIndent') {
						return [{
							javascript: true,
							css: true,
						}];
					}
					return next(params, token);
				}
			}
		}
	};
	client = new lsp.LanguageClient(
		'svelte-language-server',
		'Svelte Langauge Server',
		serverOptions,
		clientOptions,
	);
	await client.start();

	virtualFiles.register(context, client);
}

export function deactivate(): Thenable<any> | undefined {
	return client?.stop();
}
