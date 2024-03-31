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

const beginHybridMode = config.server.hybridMode;

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

async function doActivate(context: vscode.ExtensionContext, createLc: CreateLanguageClient) {

	vscode.commands.executeCommand('setContext', 'vue.activated', true);

	const outputChannel = vscode.window.createOutputChannel('Vue Language Server');

	client = createLc(
		'vue',
		'Vue',
		getDocumentSelector(),
		await getInitializationOptions(context),
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

	if (!config.server.hybridMode) {
		lsp.activateTsConfigStatusItem(selectors, 'vue.tsconfig', client);
		lsp.activateTsVersionStatusItem(selectors, 'vue.tsversion', context, client, text => 'TS ' + text);
	}

	const hybridModeStatus = vscode.languages.createLanguageStatusItem('vue-hybrid-mode', selectors);
	hybridModeStatus.text = 'Hybrid Mode';
	hybridModeStatus.detail = config.server.hybridMode ? 'Enabled' : 'Disabled';
	hybridModeStatus.command = {
		title: 'Open Setting',
		command: 'workbench.action.openSettings',
		arguments: ['vue.server.hybridMode'],
	};
	if (!config.server.hybridMode) {
		hybridModeStatus.severity = vscode.LanguageStatusSeverity.Warning;
	}

	const item = vscode.languages.createLanguageStatusItem('vue-insider', 'vue');
	if (!context.extension.packageJSON.version.includes('-insider')) {
		item.text = '✨ Get Vue - Official Insiders';
		item.severity = vscode.LanguageStatusSeverity.Warning;
		item.command = {
			title: 'More Info',
			command: 'vscode.open',
			arguments: ['https://github.com/vuejs/language-tools/wiki/Get-Insiders'],
		};
	}
	else {
		const versionsUrl = 'https://cdn.jsdelivr.net/gh/vuejs/language-tools/insiders.json';
		item.text = '🚀 Vue - Official Insiders';
		item.detail = 'Installed';
		item.busy = true;
		const currentVersion = context.extension.packageJSON.version;
		fetch(versionsUrl)
			.then(res => res.json())
			.then(({ versions }: { versions: { version: string; date: string; }[]; }) => {
				item.command = {
					title: 'Select Version',
					command: 'vue-insiders.selectVersion',
					arguments: [{ versions }],
				};
				if (versions.length && versions[0].version !== currentVersion) {
					item.command.title = 'Update';
					item.detail = 'New version available';
					item.severity = vscode.LanguageStatusSeverity.Warning;
				}
			})
			.catch(() => {
				item.detail = 'Failed to fetch versions';
			})
			.finally(() => {
				item.busy = false;
			});
		vscode.commands.registerCommand('vue-insiders.selectVersion', async ({ versions }: { versions: { version: string; date: string; }[]; }) => {
			const items = versions.map<vscode.QuickPickItem>(version => ({
				label: version.version,
				description: version.date + (version.version === currentVersion ? ' (current)' : ''),
			}));
			if (!items.some(item => item.description?.endsWith('(current)'))) {
				items.push({
					label: '',
					kind: vscode.QuickPickItemKind.Separator,
				}, {
					label: currentVersion,
					description: '(current)',
				});
			}
			const selected = await vscode.window.showQuickPick(
				items,
				{
					canPickMany: false,
					placeHolder: 'Select a version',
				});
			if (!selected || selected.label === currentVersion) {
				return;
			}
			const updateUrl = `https://github.com/volarjs/insiders/releases/tag/v${selected.label}`;
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
			if (e.affectsConfiguration('vue.server.hybridMode') && config.server.hybridMode !== beginHybridMode) {
				requestReloadVscode(
					config.server.hybridMode
						? 'Please reload VSCode to enable Hybrid Mode.'
						: 'Please reload VSCode to disable Hybrid Mode.'
				);
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
			client.clientOptions.initializationOptions = await getInitializationOptions(context);
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
			hybridMode: beginHybridMode,
			additionalExtensions: [
				...config.server.additionalExtensions,
				...!config.server.petiteVue.supportHtmlFile ? [] : ['html'],
				...!config.server.vitePress.supportMdFile ? [] : ['md'],
			],
		},
	};
}
