import { DiagnosticModel, VueInitializationOptions } from '@vue/language-server';
import * as vscode from 'vscode';
import * as lsp from '@volar/vscode';
import { config } from './config';
import * as doctor from './features/doctor';
import * as nameCasing from './features/nameCasing';
import * as splitEditors from './features/splitEditors';

let client: lsp.BaseLanguageClient;

type CreateLanguageClient = (
	id: string,
	name: string,
	langs: lsp.DocumentFilter[],
	initOptions: VueInitializationOptions,
	port: number,
	outputChannel: vscode.OutputChannel,
) => lsp.BaseLanguageClient;

export async function activate(context: vscode.ExtensionContext, createLc: CreateLanguageClient) {

	const stopCheck = vscode.window.onDidChangeActiveTextEditor(tryActivate);
	tryActivate();

	function tryActivate() {
		if (
			vscode.window.visibleTextEditors.some(editor => editor.document.languageId === 'vue')
			|| (config.server.vitePress.supportMdFile && vscode.window.visibleTextEditors.some(editor => editor.document.languageId === 'vue'))
			|| (config.server.petiteVue.supportHtmlFile && vscode.window.visibleTextEditors.some(editor => editor.document.languageId === 'html'))
		) {
			doActivate(context, createLc);
			stopCheck.dispose();
		}
	}
}

export const currentHybridModeStatus = getCurrentHybridModeStatus();

function getCurrentHybridModeStatus(report = false) {
	if (config.server.hybridMode === 'auto') {
		const unknownExtensions: string[] = [];
		for (const extension of vscode.extensions.all) {
			const hasTsPlugin = !!extension.packageJSON?.contributes?.typescriptServerPlugins;
			if (hasTsPlugin) {
				if (
					extension.id === 'Vue.volar'
					|| extension.id === 'unifiedjs.vscode-mdx'
					|| extension.id === 'astro-build.astro-vscode'
					|| extension.id === 'ije.esm-vscode'
					|| extension.id === 'johnsoncodehk.vscode-tsslint'
				) {
					continue;
				}
				else {
					unknownExtensions.push(extension.id);
				}
			}
		}
		if (unknownExtensions.length) {
			if (report) {
				vscode.window.showInformationMessage(
					`Hybrid Mode is disabled automatically because there is a potentially incompatible ${unknownExtensions.join(', ')} TypeScript plugin installed.`,
					'Report a false positive',
				).then(value => {
					if (value) {
						vscode.env.openExternal(vscode.Uri.parse('https://github.com/vuejs/language-tools/pull/4206'));
					}
				});
			}
			return false;
		}
		return true;
	}
	else {
		return config.server.hybridMode;
	}
}

async function doActivate(context: vscode.ExtensionContext, createLc: CreateLanguageClient) {

	getCurrentHybridModeStatus(true);

	const outputChannel = vscode.window.createOutputChannel('Vue Language Server');

	vscode.commands.executeCommand('setContext', 'vue.activated', true);

	client = createLc(
		'vue',
		'Vue',
		getDocumentSelector(),
		await getInitializationOptions(context, currentHybridModeStatus),
		6009,
		outputChannel
	);

	const selectors: vscode.DocumentFilter[] = [{ language: 'vue' }];

	if (config.server.petiteVue.supportHtmlFile) {
		selectors.push({ language: 'html' });
	}
	if (config.server.vitePress.supportMdFile) {
		selectors.push({ language: 'markdown' });
	}

	activateConfigWatcher();
	activateRestartRequest();

	nameCasing.activate(context, client, selectors);
	splitEditors.register(context, client);
	doctor.register(context, client);

	lsp.activateAutoInsertion(selectors, client);
	lsp.activateDocumentDropEdit(selectors, client);
	lsp.activateWriteVirtualFiles('vue.action.writeVirtualFiles', client);
	lsp.activateServerSys(client);

	if (!currentHybridModeStatus) {
		lsp.activateTsConfigStatusItem(selectors, 'vue.tsconfig', client);
		lsp.activateTsVersionStatusItem(selectors, 'vue.tsversion', context, client, text => 'TS ' + text);
	}

	const hybridModeStatus = vscode.languages.createLanguageStatusItem('vue-hybrid-mode', selectors);
	hybridModeStatus.text = 'Hybrid Mode';
	hybridModeStatus.detail = (currentHybridModeStatus ? 'Enabled' : 'Disabled') + (config.server.hybridMode === 'auto' ? ' (Auto)' : '');
	hybridModeStatus.command = {
		title: 'Open Setting',
		command: 'workbench.action.openSettings',
		arguments: ['vue.server.hybridMode'],
	};
	if (currentHybridModeStatus) {
		hybridModeStatus.severity = vscode.LanguageStatusSeverity.Warning;
	}

	const item = vscode.languages.createLanguageStatusItem('vue-insider', 'vue');
	if (!context.extension.packageJSON.version.includes('-insider')) {
		item.text = '✨ Get Vue - Official Insiders';
		item.severity = vscode.LanguageStatusSeverity.Warning;
		item.command = {
			title: 'More Info',
			command: 'vscode.open',
			arguments: ['https://github.com/vuejs/language-tools/wiki/Get-Insiders-Edition'],
		};
	}
	else {
		item.text = '🚀 Vue - Official Insiders';
		item.detail = 'Installed';
		item.command = {
			title: 'Changelog',
			command: 'vue-insiders.checkUpdate',
		};
		vscode.commands.registerCommand('vue-insiders.checkUpdate', () => {
			const updateUrl = 'https://github.com/vuejs/language-tools/blob/master/CHANGELOG.md';
			vscode.env.openExternal(vscode.Uri.parse(updateUrl));
		});
	}

	async function requestReloadVscode(msg: string) {
		const reload = await vscode.window.showInformationMessage(msg, 'Reload Window');
		if (reload === undefined) {
			return; // cancel
		}
		vscode.commands.executeCommand('workbench.action.reloadWindow');
	}

	function activateConfigWatcher() {
		context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('vue.server.hybridMode')) {
				const newStatus = getCurrentHybridModeStatus();
				if (newStatus !== currentHybridModeStatus) {
					requestReloadVscode(
						newStatus
							? 'Please reload VSCode to enable Hybrid Mode.'
							: 'Please reload VSCode to disable Hybrid Mode.'
					);
				}
			}
			else if (e.affectsConfiguration('vue')) {
				vscode.commands.executeCommand('vue.action.restartServer', false);
			}
		}));
	}

	async function activateRestartRequest() {
		context.subscriptions.push(vscode.commands.registerCommand('vue.action.restartServer', async (restartTsServer: boolean = true) => {
			await client.stop();
			outputChannel.clear();
			client.clientOptions.initializationOptions = await getInitializationOptions(context, currentHybridModeStatus);
			await client.start();
			nameCasing.activate(context, client, selectors);
			if (restartTsServer) {
				await vscode.commands.executeCommand('typescript.restartTsServer');
			}
		}));
	}
}

export function deactivate(): Thenable<any> | undefined {
	return client?.stop();
}

export function getDocumentSelector(): lsp.DocumentFilter[] {
	const selectors: lsp.DocumentFilter[] = [];
	selectors.push({ language: 'vue' });
	if (config.server.petiteVue.supportHtmlFile) {
		selectors.push({ language: 'html' });
	}
	if (config.server.vitePress.supportMdFile) {
		selectors.push({ language: 'markdown' });
	}
	return selectors;
}

async function getInitializationOptions(
	context: vscode.ExtensionContext,
	hybridMode: boolean,
): Promise<VueInitializationOptions> {
	return {
		// volar
		diagnosticModel: config.server.diagnosticModel === 'pull' ? DiagnosticModel.Pull : DiagnosticModel.Push,
		typescript: { tsdk: (await lsp.getTsdk(context)).tsdk },
		maxFileSize: config.server.maxFileSize,
		semanticTokensLegend: {
			tokenTypes: ['component'],
			tokenModifiers: [],
		},
		vue: {
			hybridMode,
			additionalExtensions: [
				...config.server.additionalExtensions,
				...!config.server.petiteVue.supportHtmlFile ? [] : ['html'],
				...!config.server.vitePress.supportMdFile ? [] : ['md'],
			],
		},
	};
}
