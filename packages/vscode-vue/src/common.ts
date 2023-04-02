import {
	activateAutoInsertion,
	activateShowVirtualFiles,
	activateWriteVirtualFiles,
	activateFindFileReferences,
	activateReloadProjects,
	activateServerStats,
	activateTsConfigStatusItem,
	activateServerSys,
	activateTsVersionStatusItem,
	getTsdk,
	takeOverModeActive,
} from '@volar/vscode';
import { DiagnosticModel, ServerMode, VueServerInitializationOptions } from '@volar/vue-language-server';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient';
import * as componentMeta from './features/componentMeta';
import * as doctor from './features/doctor';
import * as nameCasing from './features/nameCasing';
import * as splitEditors from './features/splitEditors';

let semanticClient: lsp.BaseLanguageClient;
let syntacticClient: lsp.BaseLanguageClient;

type CreateLanguageClient = (
	id: string,
	name: string,
	langs: string[],
	initOptions: VueServerInitializationOptions,
	port: number,
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
		if (currentLangId === 'vue' || (currentLangId === 'markdown' && processMd()) || (currentLangId === 'html' && processHtml())) {
			doActivate(context, createLc);
			stopCheck.dispose();
		}

		const takeOverMode = takeOverModeActive(context);
		if (takeOverMode && ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(currentLangId)) {
			doActivate(context, createLc);
			stopCheck.dispose();
		}
	}
}

async function doActivate(context: vscode.ExtensionContext, createLc: CreateLanguageClient) {

	vscode.commands.executeCommand('setContext', 'volar.activated', true);

	[semanticClient, syntacticClient] = await Promise.all([
		createLc(
			'vue-semantic-server',
			'Vue Semantic Server',
			getDocumentSelector(context),
			await getInitializationOptions(ServerMode.PartialSemantic, context),
			6009,
		),
		createLc(
			'vue-syntactic-server',
			'Vue Syntactic Server',
			getDocumentSelector(context),
			await getInitializationOptions(ServerMode.Syntactic, context),
			6011,
		)
	]);

	const clients = [semanticClient, syntacticClient];

	activateServerMaxOldSpaceSizeChange();
	activateRestartRequest();
	activateClientRequests();

	splitEditors.register(context, syntacticClient);
	doctor.register(context, semanticClient);
	componentMeta.register(context, semanticClient);

	const supportedLanguages: Record<string, boolean> = {
		vue: true,
		markdown: true,
		javascript: true,
		typescript: true,
		javascriptreact: true,
		typescriptreact: true,
	};

	activateAutoInsertion([syntacticClient, semanticClient], document => supportedLanguages[document.languageId]);
	activateShowVirtualFiles('volar.action.showVirtualFiles', semanticClient);
	activateWriteVirtualFiles('volar.action.writeVirtualFiles', semanticClient);
	activateFindFileReferences('volar.vue.findAllFileReferences', semanticClient);
	activateTsConfigStatusItem('volar.openTsconfig', semanticClient,
		document => {
			return document.languageId === 'vue'
				|| (processMd() && document.languageId === 'markdown')
				|| (processHtml() && document.languageId === 'html')
				|| (
					takeOverModeActive(context)
					&& ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(document.languageId)
				);
		},
	);
	activateReloadProjects('volar.action.reloadProject', [semanticClient]);
	activateServerStats('volar.action.serverStats', [semanticClient]);
	activateTsVersionStatusItem('volar.selectTypeScriptVersion', context, semanticClient,
		document => {
			return document.languageId === 'vue'
				|| (processMd() && document.languageId === 'markdown')
				|| (processHtml() && document.languageId === 'html')
				|| (
					takeOverModeActive(context)
					&& ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(document.languageId)
				);
		},
		text => {
			if (takeOverModeActive(context)) {
				text += ' (takeover)';
			}
			return text;
		},
		false,
	);

	for (const client of clients) {
		activateServerSys(context, client, undefined);
	}

	async function requestReloadVscode() {
		const reload = await vscode.window.showInformationMessage(
			'Please reload VSCode to restart language servers.',
			'Reload Window'
		);
		if (reload === undefined) return; // cancel
		vscode.commands.executeCommand('workbench.action.reloadWindow');
	}
	function activateServerMaxOldSpaceSizeChange() {
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (
				e.affectsConfiguration('volar.vueserver.maxOldSpaceSize')
				|| e.affectsConfiguration('volar.vueserver.diagnosticModel')
				|| e.affectsConfiguration('volar.vueserver.reverseConfigFilePriority')
				|| e.affectsConfiguration('volar.vueserver.disableFileWatcher')
				|| e.affectsConfiguration('volar.vueserver.petiteVue.processHtmlFile')
				|| e.affectsConfiguration('volar.vueserver.vitePress.processMdFile')
				|| e.affectsConfiguration('volar.vueserver.additionalExtensions')
				|| e.affectsConfiguration('volar.vueserver.maxFileSize')
				|| e.affectsConfiguration('volar.vueserver.configFilePath')
				|| e.affectsConfiguration('volar.vueserver.fullCompletionList')
			) {
				requestReloadVscode();
			}
		});
	}
	async function activateRestartRequest() {
		context.subscriptions.push(vscode.commands.registerCommand('volar.action.restartServer', async () => {
			await Promise.all(clients.map(client => client.stop()));
			await Promise.all(clients.map(client => client.start()));
			activateClientRequests();
		}));
	}
	function activateClientRequests() {
		nameCasing.activate(context, semanticClient);
	}
}

export function deactivate(): Thenable<any> | undefined {
	return Promise.all([
		semanticClient?.stop(),
		syntacticClient?.stop(),
	]);
}

export function getDocumentSelector(context: vscode.ExtensionContext) {
	const takeOverMode = takeOverModeActive(context);
	const langs = takeOverMode ? [
		'vue',
		'javascript',
		'typescript',
		'javascriptreact',
		'typescriptreact',
		'json',
		// 'jsonc',
	] : [
		'vue',
	];
	if (processHtml()) {
		langs.push('html');
	}
	if (processMd()) {
		langs.push('markdown');
	}
	return langs;
}

export function processHtml() {
	return !!vscode.workspace.getConfiguration('volar').get<boolean>('vueserver.petiteVue.processHtmlFile');
}

export function processMd() {
	return !!vscode.workspace.getConfiguration('volar').get<boolean>('vueserver.vitePress.processMdFile');
}

export function reverseConfigFilePriority() {
	return !!vscode.workspace.getConfiguration('volar').get<boolean>('vueserver.reverseConfigFilePriority');
}

export function disableFileWatcher() {
	return !!vscode.workspace.getConfiguration('volar').get<boolean>('vueserver.disableFileWatcher');
}

export function diagnosticModel() {
	return vscode.workspace.getConfiguration('volar').get<'push' | 'pull'>('vueserver.diagnosticModel');
}

function additionalExtensions() {
	return vscode.workspace.getConfiguration('volar').get<string[]>('vueserver.additionalExtensions') ?? [];
}

function fullCompletionList() {
	return vscode.workspace.getConfiguration('volar').get<boolean>('vueserver.fullCompletionList');
}

async function getInitializationOptions(
	serverMode: ServerMode,
	context: vscode.ExtensionContext,
) {
	const initializationOptions: VueServerInitializationOptions = {
		// volar
		configFilePath: vscode.workspace.getConfiguration('volar').get<string>('vueserver.configFilePath'),
		serverMode,
		diagnosticModel: diagnosticModel() === 'pull' ? DiagnosticModel.Pull : DiagnosticModel.Push,
		typescript: { tsdk: (await getTsdk(context)).tsdk },
		reverseConfigFilePriority: reverseConfigFilePriority(),
		disableFileWatcher: disableFileWatcher(),
		maxFileSize: vscode.workspace.getConfiguration('volar').get<number>('vueserver.maxFileSize'),
		semanticTokensLegend: {
			tokenTypes: ['component'],
			tokenModifiers: [],
		},
		fullCompletionList: fullCompletionList(),
		// vue
		petiteVue: {
			processHtmlFile: processHtml(),
		},
		vitePress: {
			processMdFile: processMd(),
		},
		json: {
			customBlockSchemaUrls: vscode.workspace.getConfiguration('volar').get<Record<string, string>>('vueserver.json.customBlockSchemaUrls'),
		},
		additionalExtensions: additionalExtensions(),
	};
	return initializationOptions;
}
