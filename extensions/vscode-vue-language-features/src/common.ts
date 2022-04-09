import * as shared from '@volar/shared';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient';
import * as activeSelection from './features/activeSelection';
import * as attrNameCase from './features/attrNameCase';
import * as callGraph from './features/callGraph';
import * as createWorkspaceSnippets from './features/createWorkspaceSnippets';
import * as documentVersion from './features/documentVersion';
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

let apiClient: lsp.CommonLanguageClient;
let docClient: lsp.CommonLanguageClient | undefined;
let htmlClient: lsp.CommonLanguageClient;

type CreateLanguageClient = (
	id: string,
	name: string,
	documentSelector: lsp.DocumentSelector,
	initOptions: shared.ServerInitializationOptions,
	port: number,
) => lsp.CommonLanguageClient;

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
		if (currentlangId === 'vue') {
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
	if (takeOverMode) {
		vscode.window
			.showInformationMessage('Take Over Mode enabled.', 'What is Take Over Mode?')
			.then(option => {
				if (option !== undefined) {
					vscode.env.openExternal(vscode.Uri.parse('https://github.com/johnsoncodehk/volar/discussions/471'));
				}
			});
	}

	const languageFeaturesDocumentSelector: lsp.DocumentSelector = takeOverMode ?
		[
			{ scheme: 'file', language: 'vue' },
			{ scheme: 'file', language: 'javascript' },
			{ scheme: 'file', language: 'typescript' },
			{ scheme: 'file', language: 'javascriptreact' },
			{ scheme: 'file', language: 'typescriptreact' },
			{ scheme: 'file', language: 'json' },
		] : [
			{ scheme: 'file', language: 'vue' },
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
	const _useSecondServer = useSecondServer();

	apiClient = createLc(
		'volar-language-features',
		'Volar - Language Features Server',
		languageFeaturesDocumentSelector,
		getInitializationOptions(context, 'main-language-features', undefined, _useSecondServer),
		6009,
	);
	docClient = _useSecondServer ? createLc(
		'volar-language-features-2',
		'Volar - Second Language Features Server',
		languageFeaturesDocumentSelector,
		getInitializationOptions(context, 'second-language-features', undefined, _useSecondServer),
		6010,
	) : undefined;
	htmlClient = createLc(
		'volar-document-features',
		'Volar - Document Features Server',
		documentFeaturesDocumentSelector,
		getInitializationOptions(context, 'document-features', undefined, _useSecondServer),
		6011,
	);

	const clients = [apiClient, docClient, htmlClient].filter(shared.notEmpty);

	registarUseSecondServerChange();
	registarRestartRequest();
	registarClientRequests();

	splitEditors.activate(context);
	preview.activate(context);
	createWorkspaceSnippets.activate(context);
	callGraph.activate(context, apiClient);
	verifyAll.activate(context, docClient ?? apiClient);
	virtualFiles.activate(context, docClient ?? apiClient);
	autoInsertion.activate(context, htmlClient, apiClient);
	tsVersion.activate(context, [apiClient, docClient].filter(shared.notEmpty));
	tsconfig.activate(context, docClient ?? apiClient);

	async function registarUseSecondServerChange() {
		vscode.workspace.onDidChangeConfiguration(async () => {
			const nowUseSecondServer = useSecondServer();
			if (_useSecondServer !== nowUseSecondServer) {
				const reload = await vscode.window.showInformationMessage('Please reload VSCode to restart language servers.', 'Reload Window');
				if (reload === undefined) return; // cancel
				vscode.commands.executeCommand('workbench.action.reloadWindow');
			}
		});
	}
	async function registarRestartRequest() {

		await Promise.all(clients.map(client => client.onReady()));

		context.subscriptions.push(vscode.commands.registerCommand('volar.action.restartServer', async () => {
			await Promise.all(clients.map(client => client.stop()));
			await Promise.all(clients.map(client => client.start()));
			registarClientRequests();
		}));
	}
	function registarClientRequests() {

		for (const client of clients) {
			showReferences.activate(context, client);
			documentVersion.activate(context, client);
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
	const status = vscode.workspace.getConfiguration('volar').get<boolean | 'auto'>('takeOverMode.enabled');
	if (status === 'auto') {
		return !vscode.extensions.getExtension('vscode.typescript-language-features');
	}
	return status;
}

function useSecondServer() {
	return !!vscode.workspace.getConfiguration('volar').get<boolean>('vueserver.useSecondServer');
}

function getInitializationOptions(
	context: vscode.ExtensionContext,
	mode: 'main-language-features' | 'second-language-features' | 'document-features',
	initMessage: string | undefined,
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
				diagnostics: { getDocumentVersionRequest: true },
				schemaRequestService: { getDocumentContentRequest: true },
			} : {}),
		} : undefined,
		documentFeatures: mode === 'document-features' ? {
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
