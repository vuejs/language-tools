import { createLabsInfo } from '@volar/vscode';
import * as lsp from '@volar/vscode/node';
import * as protocol from '@vue/language-server/protocol';
import * as fs from 'node:fs';
import { defineExtension, executeCommand, extensionContext, onDeactivate } from 'reactive-vscode';
import * as vscode from 'vscode';
import { config } from './config';
import { activate as activateLanguageClient, deactivate as deactivateLanguageClient } from './languageClient';
import { middleware } from './middleware';

export const { activate, deactivate } = defineExtension(async () => {
	const volarLabs = createLabsInfo(protocol);

	const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features');
	const vueTsPluginExtension = vscode.extensions.getExtension('Vue.vscode-typescript-vue-plugin');

	if (tsExtension) {
		await tsExtension.activate();
	}
	else {
		vscode.window.showWarningMessage(
			'Takeover mode is no longer needed since v2. Please enable the "TypeScript and JavaScript Language Features" extension.',
			'Show Extension'
		).then(selected => {
			if (selected) {
				executeCommand('workbench.extensions.search', '@builtin typescript-language-features');
			}
		});
	}

	if (vueTsPluginExtension) {
		vscode.window.showWarningMessage(
			`The "${vueTsPluginExtension.packageJSON.displayName}" extension is no longer needed since v2. Please uninstall it.`,
			'Show Extension'
		).then(selected => {
			if (selected) {
				executeCommand('workbench.extensions.search', vueTsPluginExtension.id);
			}
		});
	}

	const context = extensionContext.value!;
	activateLanguageClient(
		context,
		(id, name, documentSelector, initOptions, port, outputChannel) => {
			class _LanguageClient extends lsp.LanguageClient {
				fillInitializeParams(params: lsp.InitializeParams) {
					// fix https://github.com/vuejs/language-tools/issues/1959
					params.locale = vscode.env.language;
				}
			}

			let serverModule = vscode.Uri.joinPath(context.extensionUri, 'server.js');

			const serverOptions: lsp.ServerOptions = {
				run: {
					module: serverModule.fsPath,
					transport: lsp.TransportKind.ipc,
					options: {},
				},
				debug: {
					module: serverModule.fsPath,
					transport: lsp.TransportKind.ipc,
					options: { execArgv: ['--nolazy', '--inspect=' + port] },
				}
			};
			const clientOptions: lsp.LanguageClientOptions = {
				middleware,
				documentSelector: documentSelector,
				initializationOptions: initOptions,
				markdown: {
					isTrusted: true,
					supportHtml: true
				},
				outputChannel
			};
			const client = new _LanguageClient(
				id,
				name,
				serverOptions,
				clientOptions
			);
			client.start();

			volarLabs.addLanguageClient(client);

			updateProviders(client);

			client.onRequest('tsserverRequest', async ([command, args]) => {
				const tsserver = (globalThis as any).__TSSERVER__?.semantic;
				if (!tsserver) {
					return;
				}
				const res = await tsserver.executeImpl(command, args, {
					isAsync: true,
					expectsResult: true,
					lowPriority: true,
					requireSemantic: true,
				})[0];
				return res.body;
			});

			return client;
		}
	);

	onDeactivate(() => {
		deactivateLanguageClient();
	});

	return volarLabs.extensionExports;
});

function updateProviders(client: lsp.LanguageClient) {
	const initializeFeatures = (client as any).initializeFeatures;

	(client as any).initializeFeatures = (...args: any) => {
		const capabilities = (client as any)
			._capabilities as lsp.ServerCapabilities;

		if (!config.codeActions.enabled) {
			capabilities.codeActionProvider = undefined;
		}
		if (!config.codeLens.enabled) {
			capabilities.codeLensProvider = undefined;
		}

		return initializeFeatures.call(client, ...args);
	};
}

try {
	const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features')!;
	const readFileSync = fs.readFileSync;
	const extensionJsPath = require.resolve('./dist/extension.js', {
		paths: [tsExtension.extensionPath],
	});

	// @ts-expect-error
	fs.readFileSync = (...args) => {
		if (args[0] === extensionJsPath) {
			// @ts-expect-error
			let text = readFileSync(...args) as string;

			// patch readPlugins
			text = text.replace(
				'languages:Array.isArray(e.languages)',
				[
					'languages:',
					`e.name==='vue-typescript-plugin-pack'?[${config.server.includeLanguages
						.map(lang => `'${lang}'`)
						.join(',')}]`,
					':Array.isArray(e.languages)'
				].join('')
			);

			// Expose tsserver process in SingleTsServer constructor
			text = text.replace(
				',this._callbacks.destroy("server errored")}))',
				s => s + ',globalThis.__TSSERVER__||={},globalThis.__TSSERVER__[arguments[1]]=this'
			);

			/**
			 * VSCode < 1.87.0
			 */

			// patch jsTsLanguageModes
			text = text.replace(
				't.$u=[t.$r,t.$s,t.$p,t.$q]',
				s => s + '.concat("vue")'
			);
			// patch isSupportedLanguageMode
			text = text.replace(
				'.languages.match([t.$p,t.$q,t.$r,t.$s]',
				s => s + '.concat("vue")'
			);

			/**
			 * VSCode >= 1.87.0
			 */

			// patch jsTsLanguageModes
			text = text.replace(
				't.jsTsLanguageModes=[t.javascript,t.javascriptreact,t.typescript,t.typescriptreact]',
				s => s + '.concat("vue")'
			);
			// patch isSupportedLanguageMode
			text = text.replace(
				'.languages.match([t.typescript,t.typescriptreact,t.javascript,t.javascriptreact]',
				s => s + '.concat("vue")'
			);

			return text;
		}
		// @ts-expect-error
		return readFileSync(...args);
	};
} catch { }
