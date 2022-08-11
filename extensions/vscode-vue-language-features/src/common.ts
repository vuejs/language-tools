import * as shared from '@volar/shared';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient';
import * as activeSelection from './features/activeSelection';
import * as attrNameCase from './features/attrNameCase';
import * as callGraph from './features/callGraph';
import * as createWorkspaceSnippets from './features/createWorkspaceSnippets';
import * as documentContent from './features/documentContent';
import * as preview from './features/preview';
import * as showReferences from './features/showReferences';
import * as splitEditors from './features/splitEditors';
import * as autoInsertion from './features/autoInsertion';
import * as tagNameCase from './features/tagNameCase';
import * as tsVersion from './features/tsVersion';
import * as verifyAll from './features/verifyAll';
import * as virtualFiles from './features/virtualFiles';
import * as tsconfig from './features/tsconfig';
import * as doctor from './features/doctor';
import * as extractComponent from './features/extractComponent';
import * as fileReferences from './features/fileReferences';
import * as reloadProject from './features/reloadProject';

let apiClient: lsp.BaseLanguageClient;
let docClient: lsp.BaseLanguageClient | undefined;
let htmlClient: lsp.BaseLanguageClient;

type CreateLanguageClient = (
	id: string,
	name: string,
	documentSelector: lsp.DocumentSelector,
	initOptions: shared.ServerInitializationOptions,
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
		if (currentlangId === 'vue' || currentlangId === 'markdown' || currentlangId === 'html') {
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
			{ scheme: 'file', language: 'vue' },
			{ scheme: 'file', language: 'markdown' },
			{ scheme: 'file', language: 'html' },
			{ scheme: 'file', language: 'javascript' },
			{ scheme: 'file', language: 'typescript' },
			{ scheme: 'file', language: 'javascriptreact' },
			{ scheme: 'file', language: 'typescriptreact' },
			{ scheme: 'file', language: 'json' },
		] : [
			{ scheme: 'file', language: 'vue' },
			{ scheme: 'file', language: 'markdown' },
			{ scheme: 'file', language: 'html' },
		];
	const documentFeaturesDocumentSelector: lsp.DocumentSelector = takeOverMode ?
		[
			{ language: 'vue' },
			{ language: 'markdown' },
			{ language: 'html' },
			{ language: 'javascript' },
			{ language: 'typescript' },
			{ language: 'javascriptreact' },
			{ language: 'typescriptreact' },
		] : [
			{ language: 'vue' },
			{ language: 'markdown' },
			{ language: 'html' },
		];
	const _useSecondServer = useSecondServer();
	const _serverMaxOldSpaceSize = serverMaxOldSpaceSize();

	[apiClient, docClient, htmlClient] = await Promise.all([
		createLc(
			'volar-language-features',
			'Volar - Language Features Server',
			languageFeaturesDocumentSelector,
			getInitializationOptions(context, 'main-language-features', _useSecondServer),
			6009,
		),
		_useSecondServer ? createLc(
			'volar-language-features-2',
			'Volar - Second Language Features Server',
			languageFeaturesDocumentSelector,
			getInitializationOptions(context, 'second-language-features', _useSecondServer),
			6010,
		) : undefined,
		createLc(
			'volar-document-features',
			'Volar - Document Features Server',
			documentFeaturesDocumentSelector,
			getInitializationOptions(context, 'document-features', _useSecondServer),
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
	createWorkspaceSnippets.register(context);
	callGraph.register(context, apiClient);
	verifyAll.register(context, docClient ?? apiClient);
	autoInsertion.register(context, htmlClient, apiClient);
	extractComponent.register(context);
	doctor.register(context);
	virtualFiles.register('volar.action.writeVirtualFiles', context, docClient ?? apiClient);
	tsVersion.register('volar.selectTypeScriptVersion', context, [apiClient, docClient].filter(shared.notEmpty));
	tsconfig.register('volar.openTsconfig', context, docClient ?? apiClient);
	fileReferences.register('volar.vue.findAllFileReferences', apiClient);
	reloadProject.register('volar.action.reloadProject', context, [apiClient, docClient].filter(shared.notEmpty));

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
			documentContent.activate(context, client);
			activeSelection.activate(context, client);
		}

		(async () => {
			const getTagNameCase = await tagNameCase.activate(context, apiClient);
			const getAttrNameCase = await attrNameCase.activate(context, apiClient);

			apiClient.onRequest(shared.GetDocumentNameCasesRequest.type, async handler => ({
				tagNameCase: getTagNameCase(handler.uri),
				attrNameCase: getAttrNameCase(handler.uri),
			}));
		})();
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

function enabledDocumentFeaturesInHtml() {
	return !vscode.extensions.getExtension('vscode.html-language-features');
}

function useSecondServer() {
	return !!vscode.workspace.getConfiguration('volar').get<boolean>('vueserver.useSecondServer');
}

function serverMaxOldSpaceSize() {
	return vscode.workspace.getConfiguration('volar').get<number | null>('vueserver.maxOldSpaceSize');
}

function getInitializationOptions(
	context: vscode.ExtensionContext,
	mode: 'main-language-features' | 'second-language-features' | 'document-features',
	useSecondServer: boolean,
) {
	const initializationOptions: shared.ServerInitializationOptions = {
		typescript: tsVersion.getCurrentTsPaths(context),
		languageFeatures: (mode === 'main-language-features' || mode === 'second-language-features') ? {
			...(mode === 'main-language-features' ? {
				references: true,
				implementation: true,
				definition: true,
				typeDefinition: true,
				callHierarchy: true,
				hover: true,
				rename: true,
				renameFileRefactoring: true,
				signatureHelp: true,
				codeAction: true,
				workspaceSymbol: true,
				completion: {
					defaultTagNameCase: 'both',
					defaultAttrNameCase: 'kebabCase',
					getDocumentNameCasesRequest: true,
					getDocumentSelectionRequest: true,
				},
				schemaRequestService: { getDocumentContentRequest: true },
			} : {}),
			...((mode === 'second-language-features' || (mode === 'main-language-features' && !useSecondServer)) ? {
				documentHighlight: true,
				documentLink: true,
				codeLens: { showReferencesNotification: true },
				semanticTokens: true,
				inlayHints: true,
				diagnostics: true,
				schemaRequestService: { getDocumentContentRequest: true },
			} : {}),
		} : undefined,
		documentFeatures: mode === 'document-features' ? {
			allowedLanguageIds: [
				'vue',
				'javascript',
				'typescript',
				'javascriptreact',
				'typescriptreact',
				enabledDocumentFeaturesInHtml() ? 'html' : undefined,
			].filter(shared.notEmpty),
			selectionRange: true,
			foldingRange: true,
			linkedEditingRange: true,
			documentSymbol: true,
			documentColor: true,
			documentFormatting: true,
		} : undefined,
	};
	return initializationOptions;
}
