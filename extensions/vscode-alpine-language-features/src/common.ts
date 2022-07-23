import * as shared from '@volar/shared';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient';
import * as activeSelection from '../../vscode-vue-language-features/out/features/activeSelection';
import * as tsVersion from '../../vscode-vue-language-features/out/features/tsVersion';
import * as virtualFiles from '../../vscode-vue-language-features/out/features/virtualFiles';
import * as tsconfig from '../../vscode-vue-language-features/out/features/tsconfig';
import * as fileReferences from '../../vscode-vue-language-features/out/features/fileReferences';

let apiClient: lsp.BaseLanguageClient;
let docClient: lsp.BaseLanguageClient | undefined;
let htmlClient: lsp.BaseLanguageClient | undefined;

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

		const currentlangId = vscode.window.activeTextEditor?.document.languageId ?? '';
		if (currentlangId === 'html') {
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

	vscode.commands.executeCommand('setContext', 'volar.alpine.activated', true);

	const takeOverMode = takeOverModeEnabled();
	const languageFeaturesDocumentSelector: lsp.DocumentSelector = takeOverMode ?
		[
			{ scheme: 'file', language: 'html' },
			{ scheme: 'file', language: 'javascript' },
			{ scheme: 'file', language: 'typescript' },
			{ scheme: 'file', language: 'javascriptreact' },
			{ scheme: 'file', language: 'typescriptreact' },
			{ scheme: 'file', language: 'json' },
		] : [
			{ scheme: 'file', language: 'html' },
		];
	const documentFeaturesDocumentSelector: lsp.DocumentSelector = takeOverMode ?
		[
			{ language: 'html' },
			{ language: 'javascript' },
			{ language: 'typescript' },
			{ language: 'javascriptreact' },
			{ language: 'typescriptreact' },
		] : [
			{ language: 'html' },
		];
	const _useSecondServer = useSecondServer();
	const _serverMaxOldSpaceSize = serverMaxOldSpaceSize();

	[apiClient, docClient, htmlClient] = await Promise.all([
		createLc(
			'volar-alpine-language-features',
			'Volar-Alpine - Language Features Server',
			languageFeaturesDocumentSelector,
			getInitializationOptions(context, 'main-language-features', _useSecondServer),
			6109,
		),
		_useSecondServer ? createLc(
			'volar-alpine-language-features-2',
			'Volar-Alpine - Second Language Features Server',
			languageFeaturesDocumentSelector,
			getInitializationOptions(context, 'second-language-features', _useSecondServer),
			6110,
		) : undefined,
		enabledDocumentFeaturesInHtml() ? createLc(
			'volar-alpine-document-features',
			'Volar-Alpine - Document Features Server',
			documentFeaturesDocumentSelector,
			getInitializationOptions(context, 'document-features', _useSecondServer),
			6111,
		) : undefined,
	]);

	const clients = [apiClient, docClient, htmlClient].filter(shared.notEmpty);

	registerUseSecondServerChange();
	registerServerMaxOldSpaceSizeChange();
	registerRestartRequest();
	registerClientRequests();

	virtualFiles.register('volar.alpine.action.writeVirtualFiles', context, docClient ?? apiClient);
	tsVersion.register('volar.alpine.selectTypeScriptVersion', context, [apiClient, docClient].filter(shared.notEmpty));
	tsconfig.register('volar.alpine.openTsconfig', context, docClient ?? apiClient);
	fileReferences.register('volar.alpine.findAllFileReferences', apiClient);

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

		context.subscriptions.push(vscode.commands.registerCommand('volar.alpine.action.restartServer', async () => {
			await Promise.all(clients.map(client => client.stop()));
			await Promise.all(clients.map(client => client.start()));
			registerClientRequests();
		}));
	}
	function registerClientRequests() {
		for (const client of clients) {
			activeSelection.activate(context, client);
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
	return vscode.workspace.getConfiguration('volar').get<boolean>('alpine.takeOverMode.enabled');
}

function enabledDocumentFeaturesInHtml() {
	return !vscode.extensions.getExtension('vscode.html-language-features');
}

function useSecondServer() {
	return !!vscode.workspace.getConfiguration('volar').get<boolean>('alpineserver.useSecondServer');
}

function serverMaxOldSpaceSize() {
	return vscode.workspace.getConfiguration('volar').get<number | null>('alpineserver.maxOldSpaceSize');
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
					// getDocumentNameCasesRequest: true,
					// getDocumentSelectionRequest: true,
					getDocumentNameCasesRequest: false,
					getDocumentSelectionRequest: false,
				},
				// schemaRequestService: { getDocumentContentRequest: true },
				schemaRequestService: false,
			} : {}),
			...((mode === 'second-language-features' || (mode === 'main-language-features' && !useSecondServer)) ? {
				documentHighlight: true,
				documentLink: true,
				// codeLens: { showReferencesNotification: true },
				codeLens: { showReferencesNotification: false },
				semanticTokens: true,
				inlayHints: true,
				diagnostics: true,
				// schemaRequestService: { getDocumentContentRequest: true },
				schemaRequestService: false,
			} : {}),
		} : undefined,
		documentFeatures: mode === 'document-features' ? {
			allowedLanguageIds: ['html'],
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
