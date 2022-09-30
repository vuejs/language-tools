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

let apiClient: lsp.BaseLanguageClient | undefined;
let docClient: lsp.BaseLanguageClient | undefined;
let htmlClient: lsp.BaseLanguageClient;

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

	const takeOverMode = takeOverModeEnabled();
	const languageFeaturesDocumentSelector: lsp.DocumentSelector = takeOverMode ?
		[
			{ language: 'vue' },
			{ language: 'javascript' },
			{ language: 'typescript' },
			{ language: 'javascriptreact' },
			{ language: 'typescriptreact' },
			{ language: 'json' },
		] : [
			{ language: 'vue' },
		];
	const documentFeaturesDocumentSelector: lsp.DocumentSelector = takeOverMode ?
		[
			{ language: 'vue' },
			{ language: 'javascript' },
			{ language: 'typescript' },
			{ language: 'javascriptreact' },
			{ language: 'typescriptreact' },
		] : [
			{ language: 'vue' },
		];

	if (processHtml()) {
		languageFeaturesDocumentSelector.push({ language: 'html' });
		documentFeaturesDocumentSelector.push({ language: 'html' });
	}

	if (processMd()) {
		languageFeaturesDocumentSelector.push({ language: 'markdown' });
		documentFeaturesDocumentSelector.push({ language: 'markdown' });
	}

	const _useSecondServer = useSecondServer();
	const _serverMaxOldSpaceSize = serverMaxOldSpaceSize();

	[apiClient, docClient, htmlClient] = await Promise.all([
		createLc(
			'volar-language-features',
			'Volar - Language Features Server',
			languageFeaturesDocumentSelector,
			getInitializationOptions('main-language-features', context),
			getFillInitializeParams('main-language-features', _useSecondServer),
			6009,
		),
		_useSecondServer ? createLc(
			'volar-language-features-2',
			'Volar - Second Language Features Server',
			languageFeaturesDocumentSelector,
			getInitializationOptions('second-language-features', context),
			getFillInitializeParams('second-language-features', _useSecondServer),
			6010,
		) : undefined,
		createLc(
			'volar-document-features',
			'Volar - Document Features Server',
			documentFeaturesDocumentSelector,
			getInitializationOptions('document-features', context),
			getFillInitializeParams('document-features', _useSecondServer),
			6011,
		),
	]);

	const clients = [apiClient, docClient, htmlClient].filter(shared.notEmpty);

	registerUseSecondServerChange();
	registerServerMaxOldSpaceSizeChange();
	registerRestartRequest();
	registerClientRequests();

	splitEditors.register(context);
	preview.register(context);
	doctor.register(context);
	tsVersion.register('volar.selectTypeScriptVersion', context, [apiClient, docClient].filter(shared.notEmpty));
	reloadProject.register('volar.action.reloadProject', context, [apiClient, docClient].filter(shared.notEmpty));

	if (apiClient) {
		tsconfig.register('volar.openTsconfig', context, docClient ?? apiClient);
		fileReferences.register('volar.vue.findAllFileReferences', apiClient);
		verifyAll.register(context, docClient ?? apiClient);
		autoInsertion.register(context, htmlClient, apiClient);
		virtualFiles.register('volar.action.writeVirtualFiles', context, docClient ?? apiClient);
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

		// await Promise.all(clients.map(client => client.onReady()));

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

		if (apiClient) {
			nameCasing.activate(context, apiClient);
		}
	}
}

export function deactivate(): Thenable<any> | undefined {
	return Promise.all([
		apiClient?.stop(),
		docClient?.stop(),
		htmlClient?.stop(),
	].filter(shared.notEmpty));
}

export function takeOverModeEnabled() {
	const status = vscode.workspace.getConfiguration('volar').get<false | 'auto'>('takeOverMode.enabled');
	if (status /* true | 'auto' */) {
		return !vscode.extensions.getExtension('vscode.typescript-language-features');
	}
	return false;
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

function getFillInitializeParams(
	mode: 'main-language-features' | 'second-language-features' | 'document-features',
	useSecondServer: boolean,
) {

	const enableSemanticFeatures_a = mode === 'main-language-features';
	const enableSemanticFeatures_b = mode === 'second-language-features' || (mode === 'main-language-features' && !useSecondServer);
	const enabledocumentFeatures = mode === 'document-features';

	return function (params: lsp.InitializeParams) {
		if (params.capabilities.textDocument) {
			params.capabilities.textDocument.references = enableSemanticFeatures_a ? params.capabilities.textDocument.references : undefined;
			params.capabilities.textDocument.implementation = enableSemanticFeatures_a ? params.capabilities.textDocument.implementation : undefined;
			params.capabilities.textDocument.definition = enableSemanticFeatures_a ? params.capabilities.textDocument.definition : undefined;
			params.capabilities.textDocument.typeDefinition = enableSemanticFeatures_a ? params.capabilities.textDocument.typeDefinition : undefined;
			params.capabilities.textDocument.callHierarchy = enableSemanticFeatures_a ? params.capabilities.textDocument.callHierarchy : undefined;
			params.capabilities.textDocument.hover = enableSemanticFeatures_a ? params.capabilities.textDocument.hover : undefined;
			params.capabilities.textDocument.rename = enableSemanticFeatures_a ? params.capabilities.textDocument.rename : undefined;
			params.capabilities.textDocument.signatureHelp = enableSemanticFeatures_a ? params.capabilities.textDocument.signatureHelp : undefined;
			params.capabilities.textDocument.codeAction = enableSemanticFeatures_a ? params.capabilities.textDocument.codeAction : undefined;
			params.capabilities.textDocument.completion = enableSemanticFeatures_a ? params.capabilities.textDocument.completion : undefined;

			params.capabilities.textDocument.documentHighlight = enableSemanticFeatures_b ? params.capabilities.textDocument.documentHighlight : undefined;
			params.capabilities.textDocument.documentLink = enableSemanticFeatures_b ? params.capabilities.textDocument.documentLink : undefined;
			params.capabilities.textDocument.codeLens = enableSemanticFeatures_b ? params.capabilities.textDocument.codeLens : undefined;
			params.capabilities.textDocument.semanticTokens = enableSemanticFeatures_b ? params.capabilities.textDocument.semanticTokens : undefined;
			params.capabilities.textDocument.inlayHint = enableSemanticFeatures_b ? params.capabilities.textDocument.inlayHint : undefined;
			params.capabilities.textDocument.diagnostic = enableSemanticFeatures_b ? params.capabilities.textDocument.diagnostic : undefined;

			params.capabilities.textDocument.selectionRange = enabledocumentFeatures ? params.capabilities.textDocument.selectionRange : undefined;
			params.capabilities.textDocument.foldingRange = enabledocumentFeatures ? params.capabilities.textDocument.foldingRange : undefined;
			params.capabilities.textDocument.linkedEditingRange = enabledocumentFeatures ? params.capabilities.textDocument.linkedEditingRange : undefined;
			params.capabilities.textDocument.documentSymbol = enabledocumentFeatures ? params.capabilities.textDocument.documentSymbol : undefined;
			params.capabilities.textDocument.colorProvider = enabledocumentFeatures ? params.capabilities.textDocument.colorProvider : undefined;
			params.capabilities.textDocument.formatting = enabledocumentFeatures ? params.capabilities.textDocument.formatting : undefined;
			params.capabilities.textDocument.rangeFormatting = enabledocumentFeatures ? params.capabilities.textDocument.rangeFormatting : undefined;
			params.capabilities.textDocument.onTypeFormatting = enabledocumentFeatures ? params.capabilities.textDocument.onTypeFormatting : undefined;
		}
		if (params.capabilities.workspace) {
			params.capabilities.workspace.symbol = enableSemanticFeatures_a ? params.capabilities.workspace.symbol : undefined;
			params.capabilities.workspace.fileOperations = enableSemanticFeatures_a ? params.capabilities.workspace.fileOperations : undefined;
		}
	};
}

function getInitializationOptions(
	mode: 'main-language-features' | 'second-language-features' | 'document-features',
	context: vscode.ExtensionContext,
) {
	const enableSemanticFeatures_b = mode === 'second-language-features' || (mode === 'main-language-features' && !useSecondServer);
	const textDocumentSync = vscode.workspace.getConfiguration('volar').get<'incremental' | 'full' | 'none'>('vueserver.textDocumentSync');
	const initializationOptions: VueServerInitializationOptions = {
		serverMode: mode === 'document-features' ? ServerMode.Syntactic : ServerMode.Semantic,
		diagnosticModel: enableSemanticFeatures_b ? DiagnosticModel.Push : DiagnosticModel.Pull /* DiagnosticModel.Pull + params.capabilities.textDocument.diagnostic: undefined = no trigger */,
		textDocumentSync: textDocumentSync ? {
			incremental: lsp.TextDocumentSyncKind.Incremental,
			full: lsp.TextDocumentSyncKind.Full,
			none: lsp.TextDocumentSyncKind.None,
		}[textDocumentSync] : lsp.TextDocumentSyncKind.Incremental,
		typescript: tsVersion.getCurrentTsPaths(context),
		petiteVue: {
			processHtmlFile: processHtml(),
		},
		vitePress: {
			processMdFile: processMd(),
		},
	};
	return initializationOptions;
}
