import * as shared from '@volar/shared';
import * as vue from 'vscode-vue-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver/node';
import { updateConfigs } from './configs';
import { createProjects } from './projects';
import * as tsConfigs from './tsConfigs';
import { getInferredCompilerOptions } from './inferredCompilerOptions';

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

	const ts = shared.loadTypescript(options.typescript.serverPath);

	if (options.languageFeatures) {

		const inferredCompilerOptions = await getInferredCompilerOptions(ts, connection);
		const tsLocalized = options.typescript.localizedPath ? shared.loadTypescriptLocalized(options.typescript.localizedPath) : undefined;

		const projects = createProjects(
			options,
			ts,
			tsLocalized,
			connection,
			documents,
			folders,
			inferredCompilerOptions,
		);

		(await import('./features/customFeatures')).register(connection, documents, projects);
		(await import('./features/languageFeatures')).register(ts, connection, documents, projects, options.languageFeatures);
		(await import('./registers/registerlanguageFeatures')).register(connection, options.languageFeatures, vue.getSemanticTokenLegend());

		connection.client.register(vscode.DidChangeConfigurationNotification.type, undefined);
		updateConfigs(connection);
	}

	if (options.documentFeatures) {
		const formatters = await import('./formatters');
		const noStateLs = vue.getDocumentLanguageService(
			{ typescript: ts },
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
