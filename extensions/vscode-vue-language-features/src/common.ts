import {
	registerAutoInsertion,
	registerShowVirtualFiles,
	registerWriteVirtualFiles,
	registerFileReferences,
	registerReloadProjects,
	registerServerStats,
	registerVerifyAll,
	registerTsConfig,
	registerShowReferences,
	registerServerSys,
	registerTsVersion,
	getTsdk,
} from '@volar/vscode-language-client';
import { DiagnosticModel, ServerMode, VueServerInitializationOptions } from '@volar/vue-language-server';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient';
import * as componentMeta from './features/componentMeta';
import * as doctor from './features/doctor';
import * as nameCasing from './features/nameCasing';
import * as splitEditors from './features/splitEditors';

enum LanguageFeaturesKind {
	Semantic,
	Syntactic,
}

let semanticClient: lsp.BaseLanguageClient;
let syntacticClient: lsp.BaseLanguageClient;

type CreateLanguageClient = (
	id: string,
	name: string,
	langs: string[],
	initOptions: VueServerInitializationOptions,
	fillInitializeParams: (params: lsp.InitializeParams) => void,
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

		const takeOverMode = takeOverModeEnabled();
		if (takeOverMode && ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(currentLangId)) {
			doActivate(context, createLc);
			stopCheck.dispose();
		}
	}
}

async function doActivate(context: vscode.ExtensionContext, createLc: CreateLanguageClient) {

	vscode.commands.executeCommand('setContext', 'volar.activated', true);

	semanticClient = createLc(
		'vue-semantic-server',
		'Vue Semantic Server',
		getDocumentSelector(ServerMode.Semantic),
		getInitializationOptions(ServerMode.Semantic, context),
		getFillInitializeParams([LanguageFeaturesKind.Semantic]),
		6009,
	);
	syntacticClient = createLc(
		'vue-syntactic-server',
		'Vue Syntactic Server',
		getDocumentSelector(ServerMode.Syntactic),
		getInitializationOptions(ServerMode.Syntactic, context),
		getFillInitializeParams([LanguageFeaturesKind.Syntactic]),
		6011,
	);
	const clients = [semanticClient, syntacticClient];

	registerServerMaxOldSpaceSizeChange();
	registerRestartRequest();
	registerClientRequests();

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

	registerAutoInsertion(context, [syntacticClient, semanticClient], document => supportedLanguages[document.languageId]);
	registerShowVirtualFiles('volar.action.showVirtualFiles', context, semanticClient);
	registerWriteVirtualFiles('volar.action.writeVirtualFiles', context, semanticClient);
	registerFileReferences('volar.vue.findAllFileReferences', context, semanticClient);
	registerTsConfig('volar.openTsconfig', context, semanticClient,
		document => {
			return document.languageId === 'vue'
				|| (processMd() && document.languageId === 'markdown')
				|| (processHtml() && document.languageId === 'html')
				|| (
					takeOverModeEnabled()
					&& ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(document.languageId)
				);
		},
	);
	registerReloadProjects('volar.action.reloadProject', context, [semanticClient]);
	registerServerStats('volar.action.serverStats', context, [semanticClient]);
	registerVerifyAll('volar.action.verifyAllScripts', context, [semanticClient]);
	registerTsVersion('volar.selectTypeScriptVersion', context, semanticClient,
		document => {
			return document.languageId === 'vue'
				|| (processMd() && document.languageId === 'markdown')
				|| (processHtml() && document.languageId === 'html')
				|| (
					takeOverModeEnabled()
					&& ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(document.languageId)
				);
		},
		text => {
			if (takeOverModeEnabled()) {
				text += ' (vue)';
			}
			if (noProjectReferences()) {
				text += ' (noProjectReferences)';
			}
			return text;
		},
	);

	for (const client of clients) {
		registerShowReferences(context, client);
		registerServerSys(context, client);
	}

	async function requestReloadVscode() {
		const reload = await vscode.window.showInformationMessage(
			'Please reload VSCode to restart language servers.',
			'Reload Window'
		);
		if (reload === undefined) return; // cancel
		vscode.commands.executeCommand('workbench.action.reloadWindow');
	}
	function registerServerMaxOldSpaceSizeChange() {
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (
				e.affectsConfiguration('volar.vueserver.maxOldSpaceSize')
				|| e.affectsConfiguration('volar.vueserver.diagnosticModel')
				|| e.affectsConfiguration('volar.vueserver.noProjectReferences')
				|| e.affectsConfiguration('volar.vueserver.reverseConfigFilePriority')
				|| e.affectsConfiguration('volar.vueserver.disableFileWatcher')
				|| e.affectsConfiguration('volar.vueserver.petiteVue.processHtmlFile')
				|| e.affectsConfiguration('volar.vueserver.vitePress.processMdFile')
				|| e.affectsConfiguration('volar.vueserver.additionalExtensions')
				|| e.affectsConfiguration('volar.vueserver.maxFileSize')
				|| e.affectsConfiguration('volar.vueserver.configFilePath')
			) {
				requestReloadVscode();
			}
		});
	}
	async function registerRestartRequest() {
		context.subscriptions.push(vscode.commands.registerCommand('volar.action.restartServer', async () => {
			await Promise.all(clients.map(client => client.stop()));
			await Promise.all(clients.map(client => client.start()));
			registerClientRequests();
		}));
	}
	function registerClientRequests() {
		nameCasing.activate(context, semanticClient);
	}
}

export function deactivate(): Thenable<any> | undefined {
	return Promise.all([
		semanticClient?.stop(),
		syntacticClient?.stop(),
	]);
}

export function takeOverModeEnabled() {
	const status = vscode.workspace.getConfiguration('volar').get<false | 'auto'>('takeOverMode.enabled');
	if (status /* true | 'auto' */) {
		return !vscode.extensions.getExtension('vscode.typescript-language-features');
	}
	return false;
}

export function getDocumentSelector(serverMode: ServerMode) {
	const takeOverMode = takeOverModeEnabled();
	const langs = takeOverMode ? [
		'vue',
		'javascript',
		'typescript',
		'javascriptreact',
		'typescriptreact',
	] : [
		'vue',
	];
	if (takeOverMode && serverMode === ServerMode.Semantic) {
		langs.push('json');
	}
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

export function noProjectReferences() {
	return !!vscode.workspace.getConfiguration('volar').get<boolean>('vueserver.noProjectReferences');
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

function getFillInitializeParams(featuresKinds: LanguageFeaturesKind[]) {
	return function (params: lsp.InitializeParams) {

		// fix https://github.com/johnsoncodehk/volar/issues/1959
		params.locale = vscode.env.language;

		if (params.capabilities.textDocument) {
			if (!featuresKinds.includes(LanguageFeaturesKind.Semantic)) {
				params.capabilities.textDocument.references = undefined;
				params.capabilities.textDocument.implementation = undefined;
				params.capabilities.textDocument.definition = undefined;
				params.capabilities.textDocument.typeDefinition = undefined;
				params.capabilities.textDocument.callHierarchy = undefined;
				params.capabilities.textDocument.hover = undefined;
				params.capabilities.textDocument.rename = undefined;
				params.capabilities.textDocument.signatureHelp = undefined;
				params.capabilities.textDocument.codeAction = undefined;
				params.capabilities.textDocument.completion = undefined;
				// Tardy
				params.capabilities.textDocument.documentHighlight = undefined;
				params.capabilities.textDocument.documentLink = undefined;
				params.capabilities.textDocument.codeLens = undefined;
				params.capabilities.textDocument.semanticTokens = undefined;
				params.capabilities.textDocument.inlayHint = undefined;
				params.capabilities.textDocument.diagnostic = undefined;
			}
			if (!featuresKinds.includes(LanguageFeaturesKind.Syntactic)) {
				params.capabilities.textDocument.selectionRange = undefined;
				params.capabilities.textDocument.foldingRange = undefined;
				params.capabilities.textDocument.linkedEditingRange = undefined;
				params.capabilities.textDocument.documentSymbol = undefined;
				params.capabilities.textDocument.colorProvider = undefined;
				params.capabilities.textDocument.formatting = undefined;
				params.capabilities.textDocument.rangeFormatting = undefined;
				params.capabilities.textDocument.onTypeFormatting = undefined;
			}
		}
		if (params.capabilities.workspace) {
			if (!featuresKinds.includes(LanguageFeaturesKind.Semantic)) {
				params.capabilities.workspace.symbol = undefined;
				params.capabilities.workspace.fileOperations = undefined;
			}
		}
	};
}

function getInitializationOptions(
	serverMode: ServerMode,
	context: vscode.ExtensionContext,
) {
	const textDocumentSync = vscode.workspace.getConfiguration('volar').get<'incremental' | 'full' | 'none'>('vueserver.textDocumentSync');
	const initializationOptions: VueServerInitializationOptions = {
		// volar
		configFilePath: vscode.workspace.getConfiguration('volar').get<string>('vueserver.configFilePath'),
		respectClientCapabilities: true,
		serverMode,
		diagnosticModel: diagnosticModel() === 'pull' ? DiagnosticModel.Pull : DiagnosticModel.Push,
		textDocumentSync: textDocumentSync ? {
			incremental: lsp.TextDocumentSyncKind.Incremental,
			full: lsp.TextDocumentSyncKind.Full,
			none: lsp.TextDocumentSyncKind.None,
		}[textDocumentSync] : lsp.TextDocumentSyncKind.Incremental,
		typescript: { tsdk: getTsdk(context).tsdk },
		noProjectReferences: noProjectReferences(),
		reverseConfigFilePriority: reverseConfigFilePriority(),
		disableFileWatcher: disableFileWatcher(),
		maxFileSize: vscode.workspace.getConfiguration('volar').get<number>('vueserver.maxFileSize'),
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
