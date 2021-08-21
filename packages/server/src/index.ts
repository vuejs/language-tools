import * as shared from '@volar/shared';
import * as vue from 'vscode-vue-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver/node';
import { updateConfigs } from './configs';
import { createServicesManager } from './servicesManager';
import * as tsConfigs from './tsConfigs';
import * as path from 'path';

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

	if (options.languageFeatures?.renameFileRefactoring) {
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

	connection.onRequest(shared.PingRequest.type, () => 'pong' as const);
	const loadedTs = loadTs()
	if (options.languageFeatures) {
		const servicesManager = createServicesManager(
			options,
			loadedTs,
			connection,
			documents,
			folders,
		);

		(await import('./features/customFeatures')).register(connection, documents, servicesManager);
		(await import('./features/languageFeatures')).register(loadedTs.server, connection, documents, servicesManager, options.languageFeatures);
		(await import('./registers/registerlanguageFeatures')).register(connection, options.languageFeatures, vue.getSemanticTokenLegend());

		connection.client.register(vscode.DidChangeConfigurationNotification.type, undefined);
		updateConfigs(connection);
	}

	if (options.documentFeatures) {
		const formatters = await import('./formatters');
		const noStateLs = vue.getDocumentLanguageService(
			{ typescript: loadedTs.server },
			(document) => tsConfigs.getPreferences(connection, document),
			(document, options) => tsConfigs.getFormatOptions(connection, document, options),
			formatters.getFormatters(async (uri) => {
				if (options.documentFeatures?.documentFormatting?.getDocumentPrintWidthRequest) {
					const response = await connection.sendRequest(shared.GetDocumentPrintWidthRequest.type, { uri });
					if (response !== undefined) {
						return response;
					}
				}
				return options.documentFeatures?.documentFormatting?.defaultPrintWidth ?? 100;
			}),
		);

		(await import('./features/documentFeatures')).register(connection, documents, noStateLs);
		(await import('./registers/registerDocumentFeatures')).register(connection, options.documentFeatures);
	}
}

function loadTs() {
	const tsserverPath = findTsserverPath()
	connection.console.info(`Loaded tsserver: '${tsserverPath}'`);
	return {
		server: shared.loadTypescript(findTsserverPath()),
		localized: options.typescript?.localizedPath ? shared.loadTypescriptLocalized(options.typescript.localizedPath) : undefined,
	}
}

function findTsserverPath(): string {
	if (options.typescript?.serverPath) {
		return options.typescript.serverPath;
	}

	const tsServerPath = path.join('typescript', 'lib', 'tsserver.js');

	// look into node_modules of workspace root
	let executable = findPathToModule(folders[0], tsServerPath);
	if (executable) {
		return executable;
	}

	// look into node_modules of typescript-language-server
	const bundled = findPathToModule(__dirname, tsServerPath);
	if (!bundled) {
		throw Error(`Couldn't find the 'tsserver.js' module`);
	}
	return bundled;
}

export function findPathToModule(dir: string, moduleName: string): string|undefined {
    try {
        return require.resolve(moduleName, { paths: [dir] });
    } catch {
        return undefined;
    }
}
