import { ExportsInfoForLabs, supportLabsVersion } from '@volar/vscode';
import * as serverLib from '@vue/language-server';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';
import { activate as commonActivate, deactivate as commonDeactivate } from './common';
import { config } from './config';
import { middleware } from './middleware';

export async function activate(context: vscode.ExtensionContext) {

	const languageClients: lsp.LanguageClient[] = [];

	let serverPathStatusItem: vscode.StatusBarItem | undefined;

	await commonActivate(context, (
		id,
		name,
		documentSelector,
		initOptions,
		port,
		outputChannel
	) => {

		class _LanguageClient extends lsp.LanguageClient {
			fillInitializeParams(params: lsp.InitializeParams) {
				// fix https://github.com/vuejs/language-tools/issues/1959
				params.locale = vscode.env.language;
			}
		}

		let serverModule = vscode.Uri.joinPath(context.extensionUri, 'server.js');

		if (config.server.path) {
			try {
				const roots = (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath);
				const serverPath = require.resolve(config.server.path, { paths: roots });
				serverModule = vscode.Uri.file(serverPath);

				if (!serverPathStatusItem) {
					serverPathStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
					serverPathStatusItem.text = '[vue] configured server path';
					serverPathStatusItem.command = 'volar.action.gotoServerFile';
					serverPathStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
					serverPathStatusItem.show();
					vscode.commands.registerCommand(serverPathStatusItem.command, () => {
						vscode.window.showTextDocument(serverModule);
					});
				}
			} catch (err) {
				vscode.window.showWarningMessage(`Cannot find vue language server path: ${config.server.path}`);
			}
		}

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
		if (config.server.runtime === 'bun') {
			serverOptions = {
				run: {
					transport: {
						kind: lsp.TransportKind.socket,
						port,
					},
					options: runOptions,
					command: 'bun',
					args: ['--bun', 'run', serverModule.fsPath],
				},
				debug: {
					transport: {
						kind: lsp.TransportKind.socket,
						port,
					},
					options: debugOptions,
					command: 'bun',
					args: ['--bun', 'run', serverModule.fsPath],
				},
			};
		}
		const clientOptions: lsp.LanguageClientOptions = {
			middleware,
			documentSelector: documentSelector,
			initializationOptions: initOptions,
			markdown: {
				isTrusted: true,
				supportHtml: true,
			},
			outputChannel
		};
		const client = new _LanguageClient(
			id,
			name,
			serverOptions,
			clientOptions,
		);
		client.start();

		languageClients.push(client);

		updateProviders(client);

		return client;
	});

	const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features');
	const vueTsPluginExtension = vscode.extensions.getExtension('Vue.vscode-typescript-vue-plugin');

	if (tsExtension) {
		await tsExtension.activate();
	}
	else {
		vscode.window.showWarningMessage(
			`Takeover mode is not longer needed in 2.0, please enable the "TypeScript and JavaScript Language Features" extension.`,
			`Show Extension`
		).then((selected) => {
			if (selected) {
				vscode.commands.executeCommand('workbench.extensions.search', '@builtin TypeScript and JavaScript Language Features');
			}
		});
	}

	if (vueTsPluginExtension) {
		vscode.window.showWarningMessage(
			`The "${vueTsPluginExtension.packageJSON.displayName}" extension is no longer needed in 2.0, please uninstall it.`,
			`Show Extension`
		).then((selected) => {
			if (selected) {
				vscode.commands.executeCommand('workbench.extensions.search', vueTsPluginExtension.id);
			}
		});
	}

	return {
		volarLabs: {
			version: supportLabsVersion,
			codegenStackSupport: true,
			languageClients,
			languageServerProtocol: serverLib,
		},
	} satisfies ExportsInfoForLabs;
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

		// TODO: disalbe for now because this break ts plugin semantic tokens
		capabilities.semanticTokensProvider = undefined;

		return initializeFeatures.call(client, ...args);
	};
}
