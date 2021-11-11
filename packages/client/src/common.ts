import * as shared from '@volar/shared';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient';
import * as activeSelection from './features/activeSelection';
import * as attrNameCase from './features/attrNameCase';
import * as callGraph from './features/callGraph';
import * as createWorkspaceSnippets from './features/createWorkspaceSnippets';
import * as documentVersion from './features/documentVersion';
import * as documentContent from './features/documentContent';
import * as documentPrintWidth from './features/documentPrintWidth';
import * as preview from './features/preview';
import * as showReferences from './features/showReferences';
import * as splitEditors from './features/splitEditors';
import * as tagClosing from './features/tagClosing';
import * as tagNameCase from './features/tagNameCase';
import * as tsVersion from './features/tsVersion';
import * as verifyAll from './features/verifyAll';
import * as virtualFiles from './features/virtualFiles';
import * as whitelist from './features/whitelist';
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

	const lowPowerMode = lowPowerModeEnabled();
	if (lowPowerMode) {
		vscode.window
			.showInformationMessage('Low Power Mode Enabled.', 'Disable')
			.then(option => {
				if (option !== undefined) {
					vscode.commands.executeCommand('workbench.action.openSettings', 'volar.lowPowerMode');
				}
			});
	}

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

	apiClient = createLc(
		'volar-api',
		'Volar - API',
		languageFeaturesDocumentSelector,
		getInitializationOptions(context, 'api', undefined, lowPowerMode),
		6009,
	);
	docClient = !lowPowerMode ? createLc(
		'volar-document',
		'Volar - Document',
		languageFeaturesDocumentSelector,
		getInitializationOptions(context, 'doc', undefined, lowPowerMode),
		6010,
	) : undefined;
	htmlClient = createLc(
		'volar-html',
		'Volar - HTML',
		documentFeaturesDocumentSelector,
		getInitializationOptions(context, 'html', undefined, lowPowerMode),
		6011,
	);

	const clients = [apiClient, docClient, htmlClient].filter(shared.notEmpty);

	registarLowPowerModeChange();
	registarRestartRequest();
	registarClientRequests();

	splitEditors.activate(context);
	preview.activate(context);
	createWorkspaceSnippets.activate(context);
	callGraph.activate(context, apiClient);
	verifyAll.activate(context, docClient ?? apiClient);
	virtualFiles.activate(context, docClient ?? apiClient);
	tagClosing.activate(context, htmlClient, apiClient);
	tsVersion.activate(context, [apiClient, docClient].filter(shared.notEmpty));
	tsconfig.activate(context, docClient ?? apiClient);
	whitelist.activate(context, clients);

	async function registarLowPowerModeChange() {
		vscode.workspace.onDidChangeConfiguration(async () => {
			const nowIsLowPowerMode = lowPowerModeEnabled();
			if (lowPowerMode !== nowIsLowPowerMode) {
				const reload = await vscode.window.showInformationMessage('Please reload VSCode to switch low power mode.', 'Reload Window');
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
			documentPrintWidth.activate(context, client);
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

function lowPowerModeEnabled() {
	return !!vscode.workspace.getConfiguration('volar').get<boolean>('lowPowerMode');
}

function getInitializationOptions(
	context: vscode.ExtensionContext,
	mode: 'api' | 'doc' | 'html',
	initMessage: string | undefined,
	lowPowerMode: boolean,
) {
	const initializationOptions: shared.ServerInitializationOptions = {
		typescript: tsVersion.getCurrentTsPaths(context),
		languageFeatures: (mode === 'api' || mode === 'doc') ? {
			...(mode === 'api' ? {
				references: true,
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
			...((mode === 'doc' || (mode === 'api' && lowPowerMode)) ? {
				documentHighlight: true,
				documentLink: true,
				codeLens: { showReferencesNotification: true },
				semanticTokens: true,
				diagnostics: { getDocumentVersionRequest: true },
				schemaRequestService: { getDocumentContentRequest: true },
			} : {}),
		} : undefined,
		documentFeatures: mode === 'html' ? {
			selectionRange: true,
			foldingRange: true,
			linkedEditingRange: true,
			documentSymbol: true,
			documentColor: true,
			documentFormatting: {
				defaultPrintWidth: 100,
				getDocumentPrintWidthRequest: true,
			},
		} : undefined,
		initializationMessage: initMessage,
	};
	return initializationOptions;
}
