import { createLabsInfo } from '@volar/vscode';
import * as protocol from '@vue/language-server/protocol';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as lsp from '@volar/vscode/node';
import { activate as commonActivate, deactivate as commonDeactivate, enabledHybridMode, enabledTypeScriptPlugin } from './common';
import { config } from './config';
import { middleware } from './middleware';

export async function activate(context: vscode.ExtensionContext) {

	const volarLabs = createLabsInfo(protocol);

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

		const runOptions: lsp.ForkOptions = {};
		if (config.server.maxOldSpaceSize) {
			runOptions.execArgv ??= [];
			runOptions.execArgv.push("--max-old-space-size=" + config.server.maxOldSpaceSize);
		}
		const debugOptions: lsp.ForkOptions = { execArgv: ['--nolazy', '--inspect=' + port] };
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
			documentSelector: documentSelector,
			initializationOptions: initOptions,
			markdown: {
				isTrusted: true,
				supportHtml: true,
			},
			outputChannel,
		};
		const client = new _LanguageClient(
			id,
			name,
			serverOptions,
			clientOptions,
		);
		client.start();

		volarLabs.addLanguageClient(client);

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
			'Takeover mode is no longer needed since v2. Please enable the "TypeScript and JavaScript Language Features" extension.',
			'Show Extension'
		).then(selected => {
			if (selected) {
				vscode.commands.executeCommand('workbench.extensions.search', '@builtin typescript-language-features');
			}
		});
	}

	if (vueTsPluginExtension) {
		vscode.window.showWarningMessage(
			`The "${vueTsPluginExtension.packageJSON.displayName}" extension is no longer needed since v2. Please uninstall it.`,
			'Show Extension'
		).then(selected => {
			if (selected) {
				vscode.commands.executeCommand('workbench.extensions.search', vueTsPluginExtension.id);
			}
		});
	}

	return volarLabs.extensionExports;
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

try {
	const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features')!;
	const readFileSync = fs.readFileSync;
	const extensionJsPath = require.resolve('./dist/extension.js', { paths: [tsExtension.extensionPath] });

	// @ts-expect-error
	fs.readFileSync = (...args) => {
		if (args[0] === extensionJsPath) {
			// @ts-expect-error
			let text = readFileSync(...args) as string;

			if (!enabledTypeScriptPlugin) {
				text = text.replace(
					'for(const e of n.contributes.typescriptServerPlugins',
					s => s + `.filter(p=>p.name!=='typescript-vue-plugin-bundle')`
				);
			}
			else if (enabledHybridMode) {
				// patch readPlugins
				text = text.replace(
					'languages:Array.isArray(e.languages)',
					[
						'languages:',
						`e.name==='typescript-vue-plugin-bundle'?[${config.server.includeLanguages.map(lang => `"${lang}"`).join(',')}]`,
						':Array.isArray(e.languages)',
					].join('')
				);

				// VSCode < 1.87.0
				text = text.replace('t.$u=[t.$r,t.$s,t.$p,t.$q]', s => s + '.concat("vue")'); // patch jsTsLanguageModes
				text = text.replace('.languages.match([t.$p,t.$q,t.$r,t.$s]', s => s + '.concat("vue")'); // patch isSupportedLanguageMode

				// VSCode >= 1.87.0
				text = text.replace('t.jsTsLanguageModes=[t.javascript,t.javascriptreact,t.typescript,t.typescriptreact]', s => s + '.concat("vue")'); // patch jsTsLanguageModes
				text = text.replace('.languages.match([t.typescript,t.typescriptreact,t.javascript,t.javascriptreact]', s => s + '.concat("vue")'); // patch isSupportedLanguageMode
			}

			return text;
		}
		// @ts-expect-error
		return readFileSync(...args);
	};
} catch { }
