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
import { config } from './config';

let semanticClient: lsp.BaseLanguageClient;
let syntacticClient: lsp.BaseLanguageClient;

type CreateLanguageClient = (
	id: string,
	name: string,
	langs: lsp.DocumentFilter[],
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
		if (currentLangId === 'vue' || (currentLangId === 'markdown' && config.vueserver.vitePress.processMdFile) || (currentLangId === 'html' && config.vueserver.petiteVue.processHtmlFile)) {
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
			getDocumentSelector(context, ServerMode.PartialSemantic),
			await getInitializationOptions(ServerMode.PartialSemantic, context),
			6009,
		),
		createLc(
			'vue-syntactic-server',
			'Vue Syntactic Server',
			getDocumentSelector(context, ServerMode.Syntactic),
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
				|| (config.vueserver.vitePress.processMdFile && document.languageId === 'markdown')
				|| (config.vueserver.petiteVue.processHtmlFile && document.languageId === 'html')
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
				|| (config.vueserver.vitePress.processMdFile && document.languageId === 'markdown')
				|| (config.vueserver.petiteVue.processHtmlFile && document.languageId === 'html')
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
			if (e.affectsConfiguration('volar.vueserver')) {
				requestReloadVscode();
			}
			if (e.affectsConfiguration('vue.features')) {
				vscode.commands.executeCommand('volar.action.restartServer');
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

export function getDocumentSelector(context: vscode.ExtensionContext, serverMode: ServerMode): lsp.DocumentFilter[] {
	const takeOverMode = takeOverModeActive(context);
	const selectors: lsp.DocumentFilter[] = [];
	selectors.push({ language: 'vue' });
	if (takeOverMode) {
		selectors.push({ language: 'javascript' });
		selectors.push({ language: 'typescript' });
		selectors.push({ language: 'javascriptreact' });
		selectors.push({ language: 'typescriptreact' });
		if (serverMode === ServerMode.Semantic || serverMode === ServerMode.PartialSemantic) { // #2573
			// support find references for .json files
			selectors.push({ language: 'json' });
			// comment out to avoid #2648 for now
			// // support document links for tsconfig.json
			// selectors.push({ language: 'jsonc', pattern: '**/[jt]sconfig.json' });
			// selectors.push({ language: 'jsonc', pattern: '**/[jt]sconfig.*.json' });
		}
	}
	if (config.vueserver.petiteVue.processHtmlFile) {
		selectors.push({ language: 'html' });
	}
	if (config.vueserver.vitePress.processMdFile) {
		selectors.push({ language: 'markdown' });
	}
	return selectors;
}

async function getInitializationOptions(
	serverMode: ServerMode,
	context: vscode.ExtensionContext,
) {
	const initializationOptions: VueServerInitializationOptions = {
		// volar
		configFilePath: config.vueserver.configFilePath,
		serverMode,
		diagnosticModel: config.vueserver.diagnosticModel === 'pull' ? DiagnosticModel.Pull : DiagnosticModel.Push,
		typescript: { tsdk: (await getTsdk(context)).tsdk },
		reverseConfigFilePriority: config.vueserver.reverseConfigFilePriority,
		maxFileSize: config.vueserver.maxFileSize,
		semanticTokensLegend: {
			tokenTypes: ['component'],
			tokenModifiers: [],
		},
		fullCompletionList: config.vueserver.fullCompletionList,
		// vue
		petiteVue: {
			processHtmlFile: !!config.vueserver.petiteVue.processHtmlFile,
		},
		vitePress: {
			processMdFile: !!config.vueserver.vitePress.processMdFile,
		},
		json: {
			customBlockSchemaUrls: config.json.customBlockSchemaUrls,
		},
		additionalExtensions: config.vueserver.additionalExtensions,
	};
	return initializationOptions;
}
