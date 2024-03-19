import {
	activateAutoInsertion,
	activateDocumentDropEdit,
	activateServerSys,
	activateWriteVirtualFiles,
	getTsdk,
} from '@volar/vscode';
import { DiagnosticModel, VueInitializationOptions } from '@vue/language-server';
import * as vscode from 'vscode';
import type * as lsp from 'vscode-languageclient';
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

	activateConfigWatcher();
	activateRestartRequest();
	activateClientRequests();

	splitEditors.register(context, client);
	doctor.register(context, client);

	const selectors: vscode.DocumentFilter[] = [{ language: 'vue' }];

	if (config.server.petiteVue.supportHtmlFile) {
		selectors.push({ language: 'html' });
	}
	if (config.server.vitePress.supportMdFile) {
		selectors.push({ language: 'markdown' });
	}

	activateAutoInsertion(selectors, client);
	activateDocumentDropEdit(selectors, client);
	activateWriteVirtualFiles('vue.action.writeVirtualFiles', client);
	activateServerSys(client);

	async function requestReloadVscode(msg: string) {
		const reload = await vscode.window.showInformationMessage(msg, 'Reload Window');
		if (reload === undefined) return; // cancel
		vscode.commands.executeCommand('workbench.action.reloadWindow');
	}

	function activateConfigWatcher() {
		context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('vue.server.hybridMode') && config.server.hybridMode !== beginHybridMode) {
				requestReloadVscode(
					config.server.hybridMode
						? 'Please reload VSCode to enable Hybrid Mode.'
						: 'Please reload VSCode to disable Hybrid Mode.'
				);
			}
			else if (e.affectsConfiguration('vue')) {
				vscode.commands.executeCommand('vue.action.restartServer');
			}
		}));
	}

	async function activateRestartRequest() {
		context.subscriptions.push(vscode.commands.registerCommand('vue.action.restartServer', async () => {
			await client.stop();
			outputChannel.clear();
			client.clientOptions.initializationOptions = await getInitializationOptions(context);
			await client.start();
			activateClientRequests();
		}));
	}

	function activateClientRequests() {
		nameCasing.activate(context, client);
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
		typescript: { tsdk: (await getTsdk(context)).tsdk },
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
