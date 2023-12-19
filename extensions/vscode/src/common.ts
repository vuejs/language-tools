import {
	activateAutoInsertion,
	activateDocumentDropEdit,
	activateServerSys,
	activateWriteVirtualFiles,
	getTsdk,
} from '@volar/vscode';
import { DiagnosticModel, VueInitializationOptions } from '@vue/language-server';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient';
import { config } from './config';
// import * as componentMeta from './features/componentMeta';
// import * as doctor from './features/doctor';
// import * as nameCasing from './features/nameCasing';
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

		if (!vscode.window.activeTextEditor) {
			// onWebviewPanel:preview
			doActivate(context, createLc);
			stopCheck.dispose();
			return;
		}

		const currentLangId = vscode.window.activeTextEditor.document.languageId;
		if (currentLangId === 'vue' || (currentLangId === 'markdown' && config.server.vitePress.supportMdFile) || (currentLangId === 'html' && config.server.petiteVue.supportHtmlFile)) {
			doActivate(context, createLc);
			stopCheck.dispose();
		}
	}
}

async function doActivate(context: vscode.ExtensionContext, createLc: CreateLanguageClient) {

	vscode.commands.executeCommand('setContext', 'volar.activated', true);

	const outputChannel = vscode.window.createOutputChannel('Vue Language Server');

	client = createLc(
		'vue',
		'Vue',
		getDocumentSelector(),
		await getInitializationOptions(context),
		6009,
		outputChannel
	);

	activateServerMaxOldSpaceSizeChange();
	activateRestartRequest();
	activateClientRequests();

	splitEditors.register(context, client);
	// doctor.register(context, client);
	// componentMeta.register(context, client);

	const selectors: vscode.DocumentFilter[] = [{ language: 'vue' }];

	if (config.server.petiteVue.supportHtmlFile) {
		selectors.push({ language: 'html' });
	}
	if (config.server.vitePress.supportMdFile) {
		selectors.push({ language: 'markdown' });
	}

	activateAutoInsertion(selectors, client); // TODO: implement auto insert .value
	activateDocumentDropEdit(selectors, client);
	activateWriteVirtualFiles('volar.action.writeVirtualFiles', client);

	activateServerSys(client);

	async function requestReloadVscode() {
		const reload = await vscode.window.showInformationMessage(
			'Please reload VSCode to restart language servers.',
			'Reload Window'
		);
		if (reload === undefined) return; // cancel
		vscode.commands.executeCommand('workbench.action.reloadWindow');
	}

	function activateServerMaxOldSpaceSizeChange() {
		context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('vue.server.runtime') || e.affectsConfiguration('vue.server.path')) {
				requestReloadVscode();
			}
			if (e.affectsConfiguration('vue')) {
				vscode.commands.executeCommand('volar.action.restartServer');
			}
		}));
	}

	async function activateRestartRequest() {
		context.subscriptions.push(vscode.commands.registerCommand('volar.action.restartServer', async () => {

			await client.stop();

			outputChannel.clear();

			client.clientOptions.initializationOptions = await getInitializationOptions(context);

			await client.start();

			activateClientRequests();
		}));
	}

	function activateClientRequests() {
		// nameCasing.activate(context, client);
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
	options: VueInitializationOptions = {},
) {
	// volar
	options.diagnosticModel = config.server.diagnosticModel === 'pull' ? DiagnosticModel.Pull : DiagnosticModel.Push;
	options.typescript = { tsdk: (await getTsdk(context)).tsdk };
	options.reverseConfigFilePriority = config.server.reverseConfigFilePriority;
	options.maxFileSize = config.server.maxFileSize;
	options.semanticTokensLegend = {
		tokenTypes: ['component'],
		tokenModifiers: [],
	};
	options.fullCompletionList = config.server.fullCompletionList;
	options.vue = {
		hybridMode: true,
		additionalExtensions: [
			...config.server.additionalExtensions,
			...!config.server.petiteVue.supportHtmlFile ? [] : ['html'],
			...!config.server.vitePress.supportMdFile ? [] : ['md'],
		],
	};
	return options;
}
