import {
	DocumentVersionRequest,
	loadWorkspaceTypescript,
	loadWorkspaceTypescriptLocalized,
	loadVscodeTypescript,
	loadVscodeTypescriptLocalized,
	SemanticTokensChangedNotification,
	ServerInitializationOptions,
	uriToFsPath
} from '@volar/shared';
import {
	getDocumentLanguageService
} from 'vscode-vue-languageservice';
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
let updateTsdk: Function | undefined;

connection.onInitialize(onInitialize);
connection.onInitialized(onInitialized);
connection.onDidChangeConfiguration(() => {
	updateTsdk?.();
	updateConfigs(connection);
});
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
		const noStateLs = getDocumentLanguageService({ typescript: getTs().module });
		(await import('./features/htmlFeatures')).register(connection, documents, noStateLs);
	}
	else if (options.mode === 'api') {
		servicesManager = createServicesManager(
			'api',
			getTs,
			connection,
			documents,
			folders,
		);
	}
	else if (options.mode === 'doc') {
		servicesManager = createServicesManager(
			'doc',
			getTs,
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
	updateTsdk = async () => {
		const newTsdk: string | undefined = await connection.workspace.getConfiguration('typescript.tsdk') ?? undefined;
		if (newTsdk !== options.tsdk) {
			options.tsdk = newTsdk;
			servicesManager?.restartAll();
		}
	};
}

function getTs() {
	if (options.tsdk) {
		for (const folder of folders) {
			const ts = loadWorkspaceTypescript(folder, options.tsdk);
			if (ts) {
				return {
					module: ts,
					localized: loadWorkspaceTypescriptLocalized(folder, options.tsdk, options.language),
				};
			}
		}
	}
	return {
		module: loadVscodeTypescript(options.appRoot),
		localized: loadVscodeTypescriptLocalized(options.appRoot, options.language),
	}
}
