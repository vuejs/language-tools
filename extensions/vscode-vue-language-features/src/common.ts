import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient';
import * as nameCasing from './features/nameCasing';
import * as preview from './features/preview';
import * as showReferences from './features/showReferences';
import * as splitEditors from './features/splitEditors';
import * as autoInsertion from './features/autoInsertion';
import * as tsVersion from './features/tsVersion';
import * as verifyAll from './features/verifyAll';
import * as virtualFiles from './features/virtualFiles';
import * as componentMeta from './features/componentMeta';
import * as tsconfig from './features/tsconfig';
import * as doctor from './features/doctor';
import * as fileReferences from './features/fileReferences';
import * as reloadProject from './features/reloadProject';
import * as serverSys from './features/serverSys';
import { DiagnosticModel, ServerMode, VueServerInitializationOptions } from '@volar/vue-language-server';

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
) => Promise<lsp.BaseLanguageClient>;

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

		const currentlangId = vscode.window.activeTextEditor.document.languageId;
		if (currentlangId === 'vue' || (currentlangId === 'markdown' && processMd()) || (currentlangId === 'html' && processHtml())) {
			doActivate(context, createLc);
			stopCheck.dispose();
		}

		const takeOverMode = takeOverModeEnabled();
		if (takeOverMode && ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(currentlangId)) {
			doActivate(context, createLc);
			stopCheck.dispose();
		}
	}
}

async function doActivate(context: vscode.ExtensionContext, createLc: CreateLanguageClient) {

	vscode.commands.executeCommand('setContext', 'volar.activated', true);

	const _serverMaxOldSpaceSize = serverMaxOldSpaceSize();

	[semanticClient, syntacticClient] = await Promise.all([
		createLc(
			'vue-semantic-server',
			'Vue Semantic Server',
			getDocumentSelector(ServerMode.Semantic),
			getInitializationOptions(
				ServerMode.Semantic,
				context,
			),
			getFillInitializeParams([LanguageFeaturesKind.Semantic]),
			6009,
		),
		createLc(
			'vue-syntactic-server',
			'Vue Syntactic Server',
			getDocumentSelector(ServerMode.Syntactic),
			getInitializationOptions(
				ServerMode.Syntactic,
				context,
			),
			getFillInitializeParams([LanguageFeaturesKind.Syntactic]),
			6011,
		),
	]);
	const clients = [semanticClient, syntacticClient];

	registerServerMaxOldSpaceSizeChange();
	registerRestartRequest();
	registerClientRequests();

	splitEditors.register(context, syntacticClient);
	preview.register(context, syntacticClient);
	doctor.register(context, semanticClient);
	tsVersion.register('volar.selectTypeScriptVersion', context, semanticClient);
	reloadProject.register('volar.action.reloadProject', context, semanticClient);

	if (semanticClient) {
		tsconfig.register('volar.openTsconfig', context, semanticClient);
		fileReferences.register('volar.vue.findAllFileReferences', semanticClient);
		verifyAll.register(context, semanticClient);
		autoInsertion.register(context, syntacticClient, semanticClient);
		virtualFiles.register(context, semanticClient);
		componentMeta.register(context, semanticClient);
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
		vscode.workspace.onDidChangeConfiguration(async () => {
			const nowServerMaxOldSpaceSize = serverMaxOldSpaceSize();
			if (_serverMaxOldSpaceSize !== nowServerMaxOldSpaceSize) {
				return requestReloadVscode();
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

		for (const client of clients) {
			showReferences.activate(context, client);
			serverSys.activate(context, client);
		}

		if (semanticClient) {
			nameCasing.activate(context, semanticClient);
		}
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

function serverMaxOldSpaceSize() {
	return vscode.workspace.getConfiguration('volar').get<number | null>('vueserver.maxOldSpaceSize');
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
		serverMode,
		diagnosticModel: DiagnosticModel.Push,
		textDocumentSync: textDocumentSync ? {
			incremental: lsp.TextDocumentSyncKind.Incremental,
			full: lsp.TextDocumentSyncKind.Full,
			none: lsp.TextDocumentSyncKind.None,
		}[textDocumentSync] : lsp.TextDocumentSyncKind.Incremental,
		typescript: tsVersion.getCurrentTsdk(context),
		petiteVue: {
			processHtmlFile: processHtml(),
		},
		vitePress: {
			processMdFile: processMd(),
		},
		noProjectReferences: noProjectReferences(),
		additionalExtensions: additionalExtensions()
	};
	return initializationOptions;
}
