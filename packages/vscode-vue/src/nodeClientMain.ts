import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';
import { activate as commonActivate, deactivate as commonDeactivate, getDocumentSelector } from './common';
import { middleware } from './middleware';
import { ServerMode } from '@volar/vue-language-server';
import { config } from './config';

export function activate(context: vscode.ExtensionContext) {

	const cancellationPipeName = path.join(os.tmpdir(), `vscode-${context.extension.id}-cancellation-pipe.tmp`);
	const documentSelector = getDocumentSelector(context, ServerMode.Semantic);
	let cancellationPipeUpdateKey: string | undefined;

	vscode.workspace.onDidChangeTextDocument((e) => {
		let key = e.document.uri.toString() + '|' + e.document.version;
		if (cancellationPipeUpdateKey === undefined) {
			cancellationPipeUpdateKey = key;
			return;
		}
		if (documentSelector.some(filter => filter.language === e.document.languageId) && cancellationPipeUpdateKey !== key) {
			cancellationPipeUpdateKey = key;
			fs.writeFileSync(cancellationPipeName, '');
		}
	});

	let start: number | undefined;
	let isSavingMultiple = false;

	vscode.workspace.onWillSaveTextDocument((e) => {
		if (e.document.languageId !== 'vue') {
			return;
		}
		if (start !== undefined) {
			isSavingMultiple = true;
		}
		start = Date.now();
	});
	vscode.workspace.onDidSaveTextDocument(async () => {

		if (isSavingMultiple) {
			isSavingMultiple = false;
			start = undefined;
		}

		if (start === undefined) {
			return;
		}

		const time = Date.now() - start;
		start = undefined;

		if (config.codeActions.enabled && time > config.codeActions.savingTimeLimit) {
			const options = [
				'Disable codeActions',
				'Increase saveTimeLimit',
				'What is this?',
			];;
			const result = await vscode.window.showInformationMessage(
				`Saving time is too long. (${time} ms > ${config.codeActions.savingTimeLimit} ms), `,
				...options,
			);
			if (result === options[0]) {
				config.update('codeActions.enabled', false);
				vscode.window.showInformationMessage('Code Actions is disabled. (You can enable it in .vscode/settings.json)');
			}
			else if (result === options[1]) {
				vscode.commands.executeCommand('workbench.action.openSettings2', { query: 'vue.codeActions.savingTimeLimit' });
			}
			else if (result === options[2]) {
				vscode.env.openExternal(vscode.Uri.parse('https://github.com/vuejs/language-tools/discussions/2740'));
			}
		}
	});

	return commonActivate(context, (
		id,
		name,
		documentSelector,
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
		const runOptions: lsp.ForkOptions = {};
		if (config.server.maxOldSpaceSize) {
			runOptions.execArgv ??= [];
			runOptions.execArgv.push("--max-old-space-size=" + config.server.maxOldSpaceSize);
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
			documentSelector: documentSelector,
			initializationOptions: initOptions,
		};
		const client = new _LanguageClient(
			id,
			name,
			serverOptions,
			clientOptions,
		);
		client.start();

		updateProviders(client);

		return client;
	});
}

export function deactivate(): Thenable<any> | undefined {
	return commonDeactivate();
}

function updateProviders(client: lsp.LanguageClient) {

	const initializeFeatures = (client as any).initializeFeatures;

	(client as any).initializeFeatures = (...args: any) => {
		const capabilities = (client as any)._capabilities as lsp.ServerCapabilities;

		if (!config.codeActions.enabled) {
			capabilities.codeActionProvider = undefined;
		}
		if (!config.codeLens.enabled) {
			capabilities.codeLensProvider = undefined;
		}
		if (!config.updateImportsOnFileMove.enabled && capabilities.workspace?.fileOperations?.willRename) {
			capabilities.workspace.fileOperations.willRename = undefined;
		}

		return initializeFeatures.call(client, ...args);
	};
}
