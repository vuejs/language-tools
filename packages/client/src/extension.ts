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
import * as tsPlugin from './features/tsPlugin';
import * as tsVersion from './features/tsVersion';
import * as verifyAll from './features/verifyAll';
import * as virtualFiles from './features/virtualFiles';
import * as removeRefSugars from './features/removeRefSugars';

let apiClient: lsp.LanguageClient;
let docClient: lsp.LanguageClient;
let htmlClient: lsp.LanguageClient;

export async function activate(context: vscode.ExtensionContext) {
	apiClient = createLanguageService(context, 'api', 'volar-api', 'Volar - API', 6009, 'file');
	docClient = createLanguageService(context, 'doc', 'volar-document', 'Volar - Document', 6010, 'file');
	htmlClient = createLanguageService(context, 'html', 'volar-html', 'Volar - HTML', 6011, undefined);

	const clients = [apiClient, docClient, htmlClient];

	registarRestartRequest();
	registarClientRequests();

	splitEditors.activate(context);
	preview.activate(context);
	createWorkspaceSnippets.activate(context);
	callGraph.activate(context, apiClient);
	removeRefSugars.activate(context, apiClient);
	verifyAll.activate(context, docClient);
	virtualFiles.activate(context, docClient);
	tagClosing.activate(context, htmlClient, apiClient);
	tsPlugin.activate(context);
	tsVersion.activate(context, [apiClient, docClient]);

	startEmbeddedLanguageServices();

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

export function deactivate(): Thenable<void> | undefined {
	return apiClient?.stop() && docClient?.stop() && htmlClient?.stop();
}

function createLanguageService(context: vscode.ExtensionContext, mode: 'api' | 'doc' | 'html', id: string, name: string, port: number, scheme: string | undefined) {

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
	const serverInitOptions: shared.ServerInitializationOptions = {
		typescript: tsVersion.getCurrentTsPaths(context),
		languageFeatures: mode === 'api' ? {
			references: { enabledInTsScript: !tsPlugin.isTsPluginEnabled() },
			definition: true,
			typeDefinition: true,
			callHierarchy: { enabledInTsScript: true /** TODO: wait for ts plugin support call hierarchy */ },
			hover: true,
			rename: true,
			renameFileRefactoring: true,
			signatureHelp: true,
			codeAction: true,
			completion: {
				defaultTagNameCase: 'both',
				defaultAttrNameCase: 'kebabCase',
				getDocumentNameCasesRequest: true,
				getDocumentSelectionRequest: true,
			},
			schemaRequestService: { getDocumentContentRequest: true },
		} : mode === 'doc' ? {
			documentHighlight: true,
			documentLink: true,
			codeLens: { showReferencesNotification: true },
			semanticTokens: true,
			diagnostics: { getDocumentVersionRequest: true },
			schemaRequestService: { getDocumentContentRequest: true },
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
	};
	const clientOptions: lsp.LanguageClientOptions = {
		documentSelector: [
			{ scheme, language: 'vue' },
			{ scheme, language: 'javascript' },
			{ scheme, language: 'typescript' },
			{ scheme, language: 'javascriptreact' },
			{ scheme, language: 'typescriptreact' },
		],
		initializationOptions: serverInitOptions,
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
function startEmbeddedLanguageServices() {

	// track https://github.com/microsoft/vscode/issues/125748
	const ts = vscode.extensions.getExtension('vscode.typescript-language-features');

	if (ts && !ts.isActive) {
		ts.activate();
	}
}
