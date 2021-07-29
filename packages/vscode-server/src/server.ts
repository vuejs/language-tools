import * as shared from '@volar/shared';
import * as vue from 'vscode-vue-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver/node';
import { updateConfigs } from './configs';
import { createServicesManager, ServicesManager } from './servicesManager';
import * as tsConfigs from './tsConfigs';
import * as formatters from './formatters';

const connection = vscode.createConnection(vscode.ProposedFeatures.all);
const documents = new vscode.TextDocuments(TextDocument);

let options: shared.ServerInitializationOptions;
let folders: string[] = [];

connection.onInitialize(onInitialize);
connection.onInitialized(onInitialized);
connection.onDidChangeConfiguration(() => {
	updateConfigs(connection);
});
connection.listen();
documents.listen(connection);

function onInitialize(params: vscode.InitializeParams) {

	options = params.initializationOptions;
	folders = params.workspaceFolders
		? params.workspaceFolders
			.map(folder => folder.uri)
			.filter(uri => uri.startsWith('file:/'))
			.map(uri => shared.uriToFsPath(uri))
		: [];

	const result: vscode.InitializeResult = {
		capabilities: {
			textDocumentSync: vscode.TextDocumentSyncKind.Incremental,
		}
	};

	if (options.mode === 'api') {
		result.capabilities.workspace = {
			fileOperations: {
				willRename: {
					filters: [
						{ pattern: { glob: '**/*.vue' } },
						{ pattern: { glob: '**/*.js' } },
						{ pattern: { glob: '**/*.ts' } },
						{ pattern: { glob: '**/*.jsx' } },
						{ pattern: { glob: '**/*.tsx' } },
						{ pattern: { glob: '**/*.json' } },
					]
				}
			}
		}
	}

	return result;
}
async function onInitialized() {

	let servicesManager: ServicesManager | undefined;

	if (options.mode === 'html') {
		const noStateLs = vue.getDocumentLanguageService(
			{ typescript: loadTs().server },
			(document) => tsConfigs.getPreferences(connection, document),
			(document, options) => tsConfigs.getFormatOptions(connection, document, options),
			formatters,
		);
		(await import('./features/htmlFeatures')).register(connection, documents, noStateLs);
	}
	else if (options.mode === 'api') {
		servicesManager = createServicesManager(
			'api',
			loadTs,
			connection,
			documents,
			folders,
		);
	}
	else if (options.mode === 'doc') {
		servicesManager = createServicesManager(
			'doc',
			loadTs,
			connection,
			documents,
			folders,
			(uri: string) => connection.sendRequest(shared.DocumentVersionRequest.type, { uri }),
			() => connection.languages.semanticTokens.refresh(),
		);
	}

	if (servicesManager) {
		(await import('./features/customFeatures')).register(connection, documents, servicesManager);
		(await import('./features/lspFeatures')).register(connection, documents, servicesManager, !!options.enableFindReferencesInTsScript);
	}

	switch (options.mode) {
		case 'api': (await import('./registers/registerApiFeatures')).register(connection, !!options.enableFindReferencesInTsScript); break;
		case 'doc': (await import('./registers/registerDocumentFeatures')).register(connection, vue.getSemanticTokenLegend()); break;
		case 'html': (await import('./registers/registerHtmlFeatures')).register(connection); break;
	}
	connection.client.register(vscode.DidChangeConfigurationNotification.type, undefined);
	connection.onNotification(shared.RestartServerNotification.type, newTsOptions => {
		if (newTsOptions) {
			options.typescript.serverPath = newTsOptions.serverPath;
			options.typescript.localizedPath = newTsOptions.localizedPath;
		}
		servicesManager?.restartAll();
	});
	updateConfigs(connection);
}

function loadTs() {
	return {
		server: shared.loadTypescript(options.typescript.serverPath),
		localized: options.typescript.localizedPath ? shared.loadTypescriptLocalized(options.typescript.localizedPath) : undefined,
	}
}
