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
import * as focusMode from './lib/focusMode';
import * as interpolationDecorators from './lib/interpolationDecorators';
import * as reactivityVisualization from './lib/reactivityVisualization';
import * as welcome from './lib/welcome';

const serverPath = resolveServerPath();
const neededRestart = !patchTypeScriptExtension();

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

export = defineExtension(() => {
	let client: lsp.BaseLanguageClient | undefined;

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

		if (neededRestart) {
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

		watch(() => [
			config.server.path,
			config.server.includeLanguages,
		], async () => {
			const reload = await vscode.window.showInformationMessage(
				'Please restart extension host to apply the new server settings.',
				'Restart Extension Host',
			);
			if (reload) {
				executeCommand('workbench.action.restartExtensionHost');
			}
		});

		if (config.server.path) {
			if (!serverPath) {
				vscode.window.showErrorMessage('Cannot find @vue/language-server.');
				return;
			}
			vscode.window.showInformationMessage(
				`You are using a custom Vue server: ${config.server.path}. If the server fails to start, please check the path in settings.`,
				'Open Settings',
			).then(action => {
				if (action === 'Open Settings') {
					vscode.commands.executeCommand('workbench.action.openSettings', 'vue.server.path');
				}
			});
		}

		client = launch(
			serverPath ?? vscode.Uri.joinPath(context.extensionUri, 'dist', 'language-server.js').fsPath,
			vscode.env.appRoot.replace(/\\/g, '/') + '/extensions/node_modules/typescript/lib',
		);

		volarLabs.addLanguageClient(client);

		const selectors = config.server.includeLanguages;

		activateAutoInsertion(selectors, client);
		activateDocumentDropEdit(selectors, client);

		focusMode.activate(selectors);
		interpolationDecorators.activate(selectors);
		reactivityVisualization.activate(selectors);
		welcome.activate(context);
	}, { immediate: true });

	useCommand('vue.welcome', () => welcome.execute(context));
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

function launch(serverPath: string, tsdk: string) {
	const args = ['--tsdk=' + tsdk];
	const client = new lsp.LanguageClient(
		'vue',
		'Vue',
		{
			run: {
				module: serverPath,
				args,
				transport: lsp.TransportKind.ipc,
				options: {},
			},
			debug: {
				module: serverPath,
				args,
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
		vscode.commands.executeCommand<{ body?: unknown } | undefined>(
			'typescript.tsserverRequest',
			command,
			args,
			{ isAsync: true, lowPriority: true },
		).then(
			res => client.sendNotification('tsserver/response', [seq, res?.body]),
			() => client.sendNotification('tsserver/response', [seq, undefined]),
		);
	});
	client.start();

	return client;
}

function resolveServerPath() {
	const tsPluginPackPath = path.join(__dirname, '..', 'node_modules', 'vue-typescript-plugin-pack', 'index.js');

	if (!config.server.path) {
		fs.writeFileSync(tsPluginPackPath, `module.exports = require("../../dist/typescript-plugin.js");`);
		return;
	}

	if (path.isAbsolute(config.server.path)) {
		const entryFile = require.resolve('./index.js', { paths: [config.server.path] });
		const tsPluginPath = require.resolve('@vue/typescript-plugin', { paths: [path.dirname(entryFile)] });
		fs.writeFileSync(tsPluginPackPath, `module.exports = require("${tsPluginPath}");`);
		return entryFile;
	}

	for (const { uri } of vscode.workspace.workspaceFolders ?? []) {
		if (uri.scheme !== 'file') {
			continue;
		}
		try {
			const serverPath = path.join(uri.fsPath, config.server.path);
			const entryFile = require.resolve('./index.js', { paths: [serverPath] });
			const tsPluginPath = require.resolve('@vue/typescript-plugin', { paths: [path.dirname(entryFile)] });
			fs.writeFileSync(tsPluginPackPath, `module.exports = require("${tsPluginPath}");`);
			return entryFile;
		}
		catch {}
	}
}

function patchTypeScriptExtension() {
	const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features')!;
	if (tsExtension.isActive) {
		return false;
	}

	const fs = require('node:fs');
	const readFileSync = fs.readFileSync;
	const extensionJsPath = require.resolve('./dist/extension.js', { paths: [tsExtension.extensionPath] });
	const { publisher, name } = require('./package.json');
	const vueExtension = vscode.extensions.getExtension(`${publisher}.${name}`)!;
	const tsPluginName = 'vue-typescript-plugin-pack';

	vueExtension.packageJSON.contributes.typescriptServerPlugins = [
		{
			name: tsPluginName,
			enableForWorkspaceTypeScriptVersions: true,
			configNamespace: 'typescript',
			languages: config.server.includeLanguages,
		},
		{
			name: 'vue-reactivity-analysis-plugin-pack',
			enableForWorkspaceTypeScriptVersions: true,
		},
	];

	fs.readFileSync = (...args: any[]) => {
		if (args[0] === extensionJsPath) {
			let text = readFileSync(...args) as string;

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
			text = text.replace(
				'"--globalPlugins",i.plugins',
				s => s + `.sort((a,b)=>(b.name==="${tsPluginName}"?-1:0)-(a.name==="${tsPluginName}"?-1:0))`,
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
	return true;
}
