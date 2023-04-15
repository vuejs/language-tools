import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';
import { activate as commonActivate, deactivate as commonDeactivate, getDocumentSelector } from './common';
import { middleware } from './middleware';
import { ServerMode } from '@volar/vue-language-server';

export function activate(context: vscode.ExtensionContext) {

	const cancellationPipeName = path.join(os.tmpdir(), `vscode-${context.extension.id}-cancellation-pipe.tmp`);
	const langs = getDocumentSelector(context, ServerMode.Semantic);
	let cancellationPipeUpdateKey: string | undefined;

	vscode.workspace.onDidChangeTextDocument((e) => {
		let key = e.document.uri.toString() + '|' + e.document.version;
		if (cancellationPipeUpdateKey === undefined) {
			cancellationPipeUpdateKey = key;
			return;
		}
		if (langs.includes(e.document.languageId) && cancellationPipeUpdateKey !== key) {
			cancellationPipeUpdateKey = key;
			fs.writeFileSync(cancellationPipeName, '');
		}
	});

	return commonActivate(context, (
		id,
		name,
		langs,
		initOptions,
		port,
	) => {

		initOptions.cancellationPipeName = cancellationPipeName;

		class _LanguageClient extends lsp.LanguageClient {
			fillInitializeParams(params: lsp.InitializeParams) {
				// fix https://github.com/johnsoncodehk/volar/issues/1959
				params.locale = vscode.env.language;
			}
		}

		const serverModule = vscode.Uri.joinPath(context.extensionUri, 'server.js');
		const maxOldSpaceSize = vscode.workspace.getConfiguration('volar').get<number | null>('vueserver.maxOldSpaceSize');
		const runOptions: lsp.ForkOptions = {};
		if (maxOldSpaceSize) {
			runOptions.execArgv ??= [];
			runOptions.execArgv.push("--max-old-space-size=" + maxOldSpaceSize);
		}
		const debugOptions: lsp.ForkOptions = { execArgv: ['--nolazy', '--inspect=' + port] };
		let serverOptions: lsp.ServerOptions = {
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
		const bunPath: string | undefined = undefined; // path to .bun/bin/bun
		if (bunPath) {
			serverOptions = {
				run: {
					transport: {
						kind: lsp.TransportKind.socket,
						port: port + 10,
					},
					options: runOptions,
					command: bunPath,
					args: ['run', serverModule.fsPath],
				},
				debug: {
					transport: {
						kind: lsp.TransportKind.socket,
						port: port + 10,
					},
					options: debugOptions,
					command: bunPath,
					args: ['run', serverModule.fsPath],
				},
			};
		}
		const clientOptions: lsp.LanguageClientOptions = {
			middleware,
			documentSelector: langs.map<lsp.DocumentFilter>(lang => ({ language: lang })),
			initializationOptions: initOptions,
			progressOnInitialization: true,
		};
		const client = new _LanguageClient(
			id,
			name,
			serverOptions,
			clientOptions,
		);
		client.start();

		return client;
	});
}

export function deactivate(): Thenable<any> | undefined {
	return commonDeactivate();
}
