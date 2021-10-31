import * as shared from '@volar/shared';
import * as path from 'upath';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';
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
import { getRandomTipsMessage } from './features/tips';

let apiClient: lsp.LanguageClient;
let docClient: lsp.LanguageClient | undefined;
let htmlClient: lsp.LanguageClient;
let lowPowerMode = false;

export async function activate(context: vscode.ExtensionContext) {

	const stopCheck = vscode.window.onDidChangeActiveTextEditor(tryActivate);
	tryActivate();

	function tryActivate() {

		if (!vscode.window.activeTextEditor) {
			// onWebviewPanel:preview
			doActivate(context);
			stopCheck.dispose();
			return;
		}

		const currentlangId = vscode.window.activeTextEditor.document.languageId;
		if (currentlangId === 'vue') {
			doActivate(context);
			stopCheck.dispose();
		}

		const takeOverMode = takeOverModeEnabled();
		if (takeOverMode && ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(currentlangId)) {
			doActivate(context);
			stopCheck.dispose();
		}
	}
}

async function doActivate(context: vscode.ExtensionContext) {

	lowPowerMode = lowPowerModeEnabled();
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

	apiClient = createLanguageService(
		context,
		'api',
		'volar-api',
		'Volar - API',
		6009,
		languageFeaturesDocumentSelector,
		getRandomTipsMessage(),
	);
	docClient = !lowPowerMode ? createLanguageService(
		context,
		'doc',
		'volar-document',
		'Volar - Document',
		6010,
		languageFeaturesDocumentSelector,
		getRandomTipsMessage(),
		) : undefined;
	htmlClient = createLanguageService(
		context,
		'html',
		'volar-html',
		'Volar - HTML',
		6011,
		documentFeaturesDocumentSelector,
		undefined,
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

function createLanguageService(
	context: vscode.ExtensionContext,
	mode: 'api' | 'doc' | 'html',
	id: string,
	name: string,
	port: number,
	documentSelector: lsp.DocumentSelector,
	initMessage: string | undefined,
) {

	const serverModule = context.asAbsolutePath(path.join('node_modules', '@volar', 'server', 'out', 'index.js'));
	const debugOptions = { execArgv: ['--nolazy', '--inspect=' + port] };
	const serverOptions: lsp.ServerOptions = {
		run: { module: serverModule, transport: lsp.TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: lsp.TransportKind.ipc,
			options: debugOptions
		},
	};
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
	const clientOptions: lsp.LanguageClientOptions = {
		documentSelector,
		initializationOptions,
		synchronize: {
			fileEvents: vscode.workspace.createFileSystemWatcher('{**/*.vue,**/*.js,**/*.jsx,**/*.ts,**/*.tsx,**/*.json}')
		}
	};
	const client = new lsp.LanguageClient(
		id,
		name,
		serverOptions,
		clientOptions,
	);
	context.subscriptions.push(client.start());

	return client;
}
