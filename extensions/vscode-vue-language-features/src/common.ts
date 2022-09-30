import * as shared from '@volar/shared';
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
import * as tsconfig from './features/tsconfig';
import * as doctor from './features/doctor';
import * as fileReferences from './features/fileReferences';
import * as reloadProject from './features/reloadProject';
import * as serverSys from './features/serverSys';
import { DiagnosticModel, ServerMode, VueServerInitializationOptions } from '@volar/vue-language-server';

enum LanguageFeaturesKind {
	Semantic_Sensitive,
	Semantic_Tardy,
	Syntactic,
}

let client_semantic_sensitive: lsp.BaseLanguageClient | undefined;
let client_semantic_tardy: lsp.BaseLanguageClient | undefined;
let client_syntactic: lsp.BaseLanguageClient;

type CreateLanguageClient = (
	id: string,
	name: string,
	documentSelector: lsp.DocumentSelector,
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

	const _useSecondServer = useSecondServer();
	const _serverMaxOldSpaceSize = serverMaxOldSpaceSize();

	[client_semantic_sensitive, client_semantic_tardy, client_syntactic] = await Promise.all([
		createLc(
			_useSecondServer ? 'vue-semantic' : 'vue-semantic-1',
			_useSecondServer ? 'Vue Semantic Server' : 'Vue Sensitive Semantic Server',
			getDocumentSelector(ServerMode.Semantic),
			getInitializationOptions(
				ServerMode.Semantic,
				_useSecondServer ? [LanguageFeaturesKind.Semantic_Sensitive] : [LanguageFeaturesKind.Semantic_Sensitive, LanguageFeaturesKind.Semantic_Tardy],
				context,
			),
			getFillInitializeParams(_useSecondServer ? [LanguageFeaturesKind.Semantic_Sensitive] : [LanguageFeaturesKind.Semantic_Sensitive, LanguageFeaturesKind.Semantic_Tardy]),
			6009,
		),
		_useSecondServer ? createLc(
			'vue-semantic-2',
			'Vue Tardy Semantic Server',
			getDocumentSelector(ServerMode.Semantic),
			getInitializationOptions(
				ServerMode.Semantic,
				[LanguageFeaturesKind.Semantic_Tardy],
				context,
			),
			getFillInitializeParams([LanguageFeaturesKind.Semantic_Tardy]),
			6010,
		) : undefined,
		createLc(
			'vue-syntactic',
			'Vue Syntactic Server',
			getDocumentSelector(ServerMode.Syntactic),
			getInitializationOptions(
				ServerMode.Syntactic,
				[LanguageFeaturesKind.Syntactic],
				context,
			),
			getFillInitializeParams([LanguageFeaturesKind.Syntactic]),
			6011,
		),
	]);

	const clients = [client_semantic_sensitive, client_semantic_tardy, client_syntactic].filter(shared.notEmpty);

	registerUseSecondServerChange();
	registerServerMaxOldSpaceSizeChange();
	registerRestartRequest();
	registerClientRequests();

	splitEditors.register(context);
	preview.register(context);
	doctor.register(context);
	tsVersion.register('volar.selectTypeScriptVersion', context, [client_semantic_sensitive, client_semantic_tardy].filter(shared.notEmpty));
	reloadProject.register('volar.action.reloadProject', context, [client_semantic_sensitive, client_semantic_tardy].filter(shared.notEmpty));

	if (client_semantic_sensitive) {
		tsconfig.register('volar.openTsconfig', context, client_semantic_tardy ?? client_semantic_sensitive);
		fileReferences.register('volar.vue.findAllFileReferences', client_semantic_sensitive);
		verifyAll.register(context, client_semantic_tardy ?? client_semantic_sensitive);
		autoInsertion.register(context, client_syntactic, client_semantic_sensitive);
		virtualFiles.register('volar.action.writeVirtualFiles', context, client_semantic_tardy ?? client_semantic_sensitive);
	}

	async function requestReloadVscode() {
		const reload = await vscode.window.showInformationMessage(
			'Please reload VSCode to restart language servers.',
			'Reload Window'
		);
		if (reload === undefined) return; // cancel
		vscode.commands.executeCommand('workbench.action.reloadWindow');
	}
	function registerUseSecondServerChange() {
		vscode.workspace.onDidChangeConfiguration(async () => {
			const nowUseSecondServer = useSecondServer();
			if (_useSecondServer !== nowUseSecondServer) {
				return requestReloadVscode();
			}
		});
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

		if (client_semantic_sensitive) {
			nameCasing.activate(context, client_semantic_sensitive);
		}
	}
}

export function deactivate(): Thenable<any> | undefined {
	return Promise.all([
		client_semantic_sensitive?.stop(),
		client_semantic_tardy?.stop(),
		client_syntactic?.stop(),
	].filter(shared.notEmpty));
}

export function takeOverModeEnabled() {
	const status = vscode.workspace.getConfiguration('volar').get<false | 'auto'>('takeOverMode.enabled');
	if (status /* true | 'auto' */) {
		return !vscode.extensions.getExtension('vscode.typescript-language-features');
	}
	return false;
}

function getDocumentSelector(serverMode: ServerMode) {
	const takeOverMode = takeOverModeEnabled();
	const selector: lsp.DocumentSelector = takeOverMode ?
		[
			{ language: 'vue' },
			{ language: 'javascript' },
			{ language: 'typescript' },
			{ language: 'javascriptreact' },
			{ language: 'typescriptreact' },
		] : [
			{ language: 'vue' },
		];
	if (takeOverMode && serverMode === ServerMode.Semantic) {
		selector.push({ language: 'json' });
	}
	if (processHtml()) {
		selector.push({ language: 'html' });
	}
	if (processMd()) {
		selector.push({ language: 'markdown' });
	}
	return selector;
}

function useSecondServer() {
	return !!vscode.workspace.getConfiguration('volar').get<boolean>('vueserver.useSecondServer');
}

function serverMaxOldSpaceSize() {
	return vscode.workspace.getConfiguration('volar').get<number | null>('vueserver.maxOldSpaceSize');
}

function processHtml() {
	return !!vscode.workspace.getConfiguration('volar').get<boolean>('vueserver.petiteVue.processHtmlFile');
}

function processMd() {
	return !!vscode.workspace.getConfiguration('volar').get<boolean>('vueserver.vitePress.processMdFile');
}

function getFillInitializeParams(featuresKinds: LanguageFeaturesKind[]) {
	return function (params: lsp.InitializeParams) {
		if (params.capabilities.textDocument) {
			if (!featuresKinds.includes(LanguageFeaturesKind.Semantic_Sensitive)) {
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
			}
			if (!featuresKinds.includes(LanguageFeaturesKind.Semantic_Tardy)) {
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
			if (!featuresKinds.includes(LanguageFeaturesKind.Semantic_Sensitive)) {
				params.capabilities.workspace.symbol = undefined;
				params.capabilities.workspace.fileOperations = undefined;
			}
		}
	};
}

function getInitializationOptions(
	serverMode: ServerMode,
	featuresKinds: LanguageFeaturesKind[],
	context: vscode.ExtensionContext,
) {
	const textDocumentSync = vscode.workspace.getConfiguration('volar').get<'incremental' | 'full' | 'none'>('vueserver.textDocumentSync');
	const initializationOptions: VueServerInitializationOptions = {
		serverMode,
		diagnosticModel: featuresKinds.includes(LanguageFeaturesKind.Semantic_Tardy) ? DiagnosticModel.Push : DiagnosticModel.None,
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
	};
	return initializationOptions;
}
