import { ServerMode } from '@volar/vue-language-server';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';
import { activate as commonActivate, deactivate as commonDeactivate, getDocumentSelector } from './common';
import { middleware } from './middleware';

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
		fillInitializeParams,
		port,
	) => {

		initOptions.cancellationPipeName = cancellationPipeName;

		class _LanguageClient extends lsp.LanguageClient {
			fillInitializeParams(params: lsp.InitializeParams) {
				fillInitializeParams(params);
			}
		}

		const serverModule = vscode.Uri.joinPath(context.extensionUri, 'server.js');
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
