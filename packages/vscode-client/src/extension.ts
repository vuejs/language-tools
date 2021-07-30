import type * as shared from '@volar/shared';
import * as path from 'upath';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';
import * as activeSelection from './features/activeSelection';
import * as attrNameCase from './features/attrNameCase';
import * as callGraph from './features/callGraph';
import * as createWorkspaceSnippets from './features/createWorkspaceSnippets';
import * as documentVersion from './features/documentVersion';
import * as documentContent from './features/documentContent';
import * as preview from './features/preview';
import * as restart from './features/restart';
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

	splitEditors.activate(context);
	preview.activate(context);
	createWorkspaceSnippets.activate(context);
	tagNameCase.activate(context, apiClient);
	attrNameCase.activate(context, apiClient);
	callGraph.activate(context, apiClient);
	removeRefSugars.activate(context, apiClient);
	showReferences.activate(context, apiClient);
	documentVersion.activate(context, docClient);
	documentContent.activate(context, apiClient);
	documentContent.activate(context, docClient);
	activeSelection.activate(context, apiClient);
	verifyAll.activate(context, docClient);
	virtualFiles.activate(context, docClient);
	tagClosing.activate(context, htmlClient, apiClient);
	restart.activate(context, [apiClient, docClient]);
	tsPlugin.activate(context);
	tsVersion.activate(context, [apiClient, docClient]);

	startEmbeddedLanguageServices();
}

export function deactivate(): Thenable<void> | undefined {
	return apiClient?.stop() && docClient?.stop() && htmlClient?.stop();
}

function createLanguageService(context: vscode.ExtensionContext, mode: 'api' | 'doc' | 'html', id: string, name: string, port: number, scheme: string | undefined) {

	const serverModule = context.asAbsolutePath(path.join('node_modules', '@volar', 'vscode-server', 'out', 'server.js'));
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
		features: mode === 'api' ? {
			references: { enabledInTsScript: !tsPlugin.isTsPluginEnabled() },
			definition: true,
			typeDefinition: true,
			callHierarchy: { enabledInTsScript: true /** TODO: wait for ts plugin support call hierarchy */ },
			hover: true,
			rename: true,
			renameFileRefactoring: true,
			selectionRange: true,
			signatureHelp: true,
			completion: true,
		} : mode === 'doc' ? {
			documentHighlight: true,
			documentSymbol: true,
			documentLink: true,
			documentColor: true,
			codeLens: true,
			semanticTokens: true,
			codeAction: true,
			diagnostics: true,
		} : undefined,
		htmlFeatures: mode === 'html' ? {
			foldingRange: true,
			linkedEditingRange: true,
			documentFormatting: true,
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
