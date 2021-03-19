import {
	DocumentVersionRequest,
	loadVscodeTypescript,
	loadVscodeTypescriptLocalized,
	SemanticTokensChangedNotification,
	ServerInitializationOptions,
	uriToFsPath
} from '@volar/shared';
import {
	createNoStateLanguageService,
	defaultLanguages
} from '@volar/vscode-vue-languageservice';
import {
	DidChangeConfigurationNotification,
	InitializeParams,
	InitializeResult,
	TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { updateConfigs } from './configs';
import './features/customFeatures';
import './features/lspFeatures';
import { connection, documents, servicesManager, setHost, setNoStateLs } from './instances';
import { createServicesManager } from './servicesManager';

let mode: ServerInitializationOptions['mode'] = 'api';

connection.onInitialize(onInitialize);
connection.onInitialized(onInitialized);
connection.onDidChangeConfiguration(updateConfigs);
connection.listen();
documents.listen(connection);

function onInitialize(params: InitializeParams) {

	const options: ServerInitializationOptions = params.initializationOptions;
	const folders = params.workspaceFolders
		? params.workspaceFolders
			.map(folder => folder.uri)
			.filter(uri => uri.startsWith('file:/'))
			.map(uri => uriToFsPath(uri))
		: [];
	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
		}
	};

	mode = options.mode;

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

	if (options.config['volar.style.defaultLanguage']) {
		defaultLanguages.style = options.config['volar.style.defaultLanguage'];
	}

	if (options.mode === 'html') {
		setNoStateLs(createNoStateLanguageService({ typescript: loadVscodeTypescript(options.appRoot) }));
	}
	else if (options.mode === 'api') {
		setHost(createServicesManager(
			loadVscodeTypescript(options.appRoot),
			loadVscodeTypescriptLocalized(options.appRoot, options.language),
			connection,
			documents,
			folders,
		));
	}
	else if (options.mode === 'doc') {
		setHost(createServicesManager(
			loadVscodeTypescript(options.appRoot),
			loadVscodeTypescriptLocalized(options.appRoot, options.language),
			connection,
			documents,
			folders,
			async (uri: string) => await connection.sendRequest(DocumentVersionRequest.type, { uri }),
			async () => await connection.sendNotification(SemanticTokensChangedNotification.type),
		));
	}

	return result;
}
function onInitialized() {
	switch (mode) {
		case 'api': import('./registers/registerApiFeatures'); break;
		case 'doc': import('./registers/registerDocumentFeatures'); break;
		case 'html': import('./registers/registerHtmlFeatures'); break;
	}
	servicesManager?.onConnectionInited();
	connection.client.register(DidChangeConfigurationNotification.type, undefined);
	updateConfigs();
}
