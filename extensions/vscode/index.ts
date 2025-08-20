import { activateAutoInsertion, activateDocumentDropEdit, createLabsInfo, middleware } from '@volar/vscode';
import * as lsp from '@volar/vscode/node';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
	defineExtension,
	executeCommand,
	extensionContext,
	nextTick,
	onDeactivate,
	useActiveTextEditor,
	useCommand,
	useOutputChannel,
	useVisibleTextEditors,
	watch,
} from 'reactive-vscode';
import * as vscode from 'vscode';
import { config } from './lib/config';
import { activate as activateWelcome } from './lib/welcome';

let client: lsp.BaseLanguageClient | undefined;
let needRestart = false;

for (
	const incompatibleExtensionId of [
		'johnsoncodehk.vscode-typescript-vue-plugin',
		'Vue.vscode-typescript-vue-plugin',
	]
) {
	const extension = vscode.extensions.getExtension(incompatibleExtensionId);
	if (extension) {
		vscode.window.showErrorMessage(
			`The "${incompatibleExtensionId}" extension is incompatible with the Vue extension. Please uninstall it.`,
			'Show Extension',
		).then(action => {
			if (action === 'Show Extension') {
				vscode.commands.executeCommand('workbench.extensions.search', '@id:' + incompatibleExtensionId);
			}
		});
	}
}

export const { activate, deactivate } = defineExtension(() => {
	const context = extensionContext.value!;
	const volarLabs = createLabsInfo();
	const activeTextEditor = useActiveTextEditor();
	const visibleTextEditors = useVisibleTextEditors();
	const { stop } = watch(activeTextEditor, () => {
		if (
			!visibleTextEditors.value.some(
				editor => config.server.includeLanguages.includes(editor.document.languageId),
			)
		) {
			return;
		}

		nextTick(() => stop());

		if (needRestart) {
			vscode.window.showInformationMessage(
				'Please restart the extension host to activate Vue support.',
				'Restart Extension Host',
				'Reload Window',
			).then(action => {
				if (action === 'Restart Extension Host') {
					vscode.commands.executeCommand('workbench.action.restartExtensionHost');
				}
				else if (action === 'Reload Window') {
					vscode.commands.executeCommand('workbench.action.reloadWindow');
				}
			});
			return;
		}

		watch(() => config.server.includeLanguages, async () => {
			const reload = await vscode.window.showInformationMessage(
				'Please restart extension host to apply the new language settings.',
				'Restart Extension Host',
			);
			if (reload) {
				executeCommand('workbench.action.restartExtensionHost');
			}
		});

		// Setup typescript.js in production mode
		if (fs.existsSync(path.join(__dirname, 'language-server.js'))) {
			fs.writeFileSync(
				path.join(__dirname, 'typescript.js'),
				`module.exports = require("${
					vscode.env.appRoot.replace(/\\/g, '/')
				}/extensions/node_modules/typescript/lib/typescript.js");`,
			);
		}

		volarLabs.addLanguageClient(client = launch(context));

		const selectors = config.server.includeLanguages;

		activateAutoInsertion(selectors, client);
		activateDocumentDropEdit(selectors, client);
		activateWelcome();
	}, { immediate: true });

	useCommand('vue.action.restartServer', async () => {
		await executeCommand('typescript.restartTsServer');
		await client?.stop();
		client?.outputChannel.clear();
		await client?.start();
	});

	onDeactivate(async () => {
		await client?.stop();
	});

	return volarLabs.extensionExports;
});

function launch(context: vscode.ExtensionContext) {
	const serverModule = vscode.Uri.joinPath(context.extensionUri, 'dist', 'language-server.js');
	const client = new lsp.LanguageClient(
		'vue',
		'Vue',
		{
			run: {
				module: serverModule.fsPath,
				transport: lsp.TransportKind.ipc,
				options: {},
			},
			debug: {
				module: serverModule.fsPath,
				transport: lsp.TransportKind.ipc,
				options: { execArgv: ['--nolazy', '--inspect=' + 6009] },
			},
		},
		{
			middleware: {
				...middleware,
				async resolveCodeAction(item, token, next) {
					if (item.kind?.value === 'refactor.move.newFile.dumb' && config.codeActions.askNewComponentName) {
						const inputName = await vscode.window.showInputBox({ value: (item as any).data.original.data.newName });
						if (!inputName) {
							return item; // cancel
						}
						(item as any).data.original.data.newName = inputName;
					}
					return await (middleware.resolveCodeAction?.(item, token, next) ?? next(item, token));
				},
			},
			documentSelector: config.server.includeLanguages,
			markdown: {
				isTrusted: true,
				supportHtml: true,
			},
			outputChannel: useOutputChannel('Vue Language Server'),
		},
	);

	client.onNotification('tsserver/request', ([seq, command, args]) => {
		vscode.commands.executeCommand<{ body: unknown } | undefined>(
			'typescript.tsserverRequest',
			command,
			args,
			{ isAsync: true, lowPriority: true },
		).then(res => {
			client.sendNotification('tsserver/response', [seq, res?.body]);
		}, () => {
			client.sendNotification('tsserver/response', [seq, undefined]);
		});
	});
	client.start();

	return client;
}

const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features')!;
if (tsExtension.isActive) {
	needRestart = true;
}
else {
	const fs = require('node:fs');
	const readFileSync = fs.readFileSync;
	const extensionJsPath = require.resolve('./dist/extension.js', {
		paths: [tsExtension.extensionPath],
	});

	// @ts-expect-error
	fs.readFileSync = (...args) => {
		if (args[0] === extensionJsPath) {
			let text = readFileSync(...args) as string;

			// patch readPlugins
			text = text.replace(
				'languages:Array.isArray(e.languages)',
				[
					'languages:',
					`e.name==='vue-typescript-plugin-pack'?[${
						config.server.includeLanguages
							.map(lang => `'${lang}'`)
							.join(',')
					}]`,
					':Array.isArray(e.languages)',
				].join(''),
			);

			// patch jsTsLanguageModes
			text = text.replace(
				't.jsTsLanguageModes=[t.javascript,t.javascriptreact,t.typescript,t.typescriptreact]',
				s => s + '.concat("vue")',
			);
			// patch isSupportedLanguageMode
			text = text.replace(
				'.languages.match([t.typescript,t.typescriptreact,t.javascript,t.javascriptreact]',
				s => s + '.concat("vue")',
			);

			// sort plugins for johnsoncodehk.tsslint, zardoy.ts-essential-plugins
			const vuePluginName = require('./package.json').contributes.typescriptServerPlugins[0].name;
			text = text.replace(
				'"--globalPlugins",i.plugins',
				s => s + `.sort((a,b)=>(b.name==="${vuePluginName}"?-1:0)-(a.name==="${vuePluginName}"?-1:0))`,
			);

			return text;
		}
		return readFileSync(...args);
	};

	const loadedModule = require.cache[extensionJsPath];
	if (loadedModule) {
		delete require.cache[extensionJsPath];
		const patchedModule = require(extensionJsPath);
		Object.assign(loadedModule.exports, patchedModule);
	}
}
