import {
	DocumentVersionRequest,
	loadVscodeTypescript,
	loadVscodeTypescriptLocalized,
	SemanticTokensChangedNotification,
	ServerInitializationOptions,
	uriToFsPath
} from '@volar/shared';
import {
	createNoStateLanguageService
} from '@volar/vscode-vue-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	createConnection,
	DidChangeConfigurationNotification,
	InitializeParams,
	InitializeResult,
	ProposedFeatures,
	TextDocuments,
	TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { updateConfigs } from './configs';
import { createServicesManager, ServicesManager } from './servicesManager';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let options: ServerInitializationOptions;
let folders: string[] = [];

connection.onInitialize(onInitialize);
connection.onInitialized(onInitialized);
connection.onDidChangeConfiguration(() => updateConfigs(connection));
connection.listen();
documents.listen(connection);

function onInitialize(params: InitializeParams) {

	options = params.initializationOptions;
	folders = params.workspaceFolders
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
		const noStateLs = createNoStateLanguageService({ typescript: loadVscodeTypescript(options.appRoot) });
		(await import('./features/htmlFeatures')).register(connection, documents, noStateLs);
	}
	else if (options.mode === 'api') {
		servicesManager = createServicesManager(
			'api',
			loadVscodeTypescript(options.appRoot),
			loadVscodeTypescriptLocalized(options.appRoot, options.language),
			connection,
			documents,
			folders,
		);
	}
	else if (options.mode === 'doc') {
		servicesManager = createServicesManager(
			'doc',
			loadVscodeTypescript(options.appRoot),
			loadVscodeTypescriptLocalized(options.appRoot, options.language),
			connection,
			documents,
			folders,
			async (uri: string) => await connection.sendRequest(DocumentVersionRequest.type, { uri }),
			async () => await connection.sendNotification(SemanticTokensChangedNotification.type),
		);
	}

	if (servicesManager) {
		(await import('./features/customFeatures')).register(connection, documents, servicesManager);
		(await import('./features/lspFeatures')).register(connection, documents, servicesManager, options.tsPlugin);
	}

	switch (options.mode) {
		case 'api': (await import('./registers/registerApiFeatures')).register(connection, options.tsPlugin); break;
		case 'doc': (await import('./registers/registerDocumentFeatures')).register(connection); break;
		case 'html': (await import('./registers/registerHtmlFeatures')).register(connection); break;
	}
	connection.client.register(DidChangeConfigurationNotification.type, undefined);
	updateConfigs(connection);
}
