import * as shared from '@volar/shared';
import * as vue from 'vscode-vue-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver/node';
import { updateConfigs } from './configs';
import { createProjects } from './projects';
import * as tsConfigs from './tsConfigs';
import { getInferredCompilerOptions } from './inferredCompilerOptions';

const connection = vscode.createConnection(vscode.ProposedFeatures.all);
connection.onInitialize(onInitialize);
connection.listen();

const documents = new vscode.TextDocuments(TextDocument);
documents.listen(connection);

connection.onRequest(shared.PingRequest.type, () => 'pong' as const);
connection.onRequest(shared.DepsRequest.type, () => Object.keys(require.cache));

async function onInitialize(params: vscode.InitializeParams) {

	const options: shared.ServerInitializationOptions = params.initializationOptions;
	const folders = params.workspaceFolders
		? params.workspaceFolders
			.map(folder => folder.uri)
			.filter(uri => uri.startsWith('file:/'))
			.map(uri => shared.uriToFsPath(uri))
		: [];

	const result: vscode.InitializeResult = {
		capabilities: {
			textDocumentSync: vscode.TextDocumentSyncKind.Incremental,
		},
	};

	if (options.documentFeatures) {

		const ts = shared.loadTypescript(options.typescript.serverPath);
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
		(await import('./registers/registerDocumentFeatures')).register(options.documentFeatures, result.capabilities);
	}

	if (options.languageFeatures) {

		let projects: ReturnType<typeof createProjects> | undefined;

		const ts = shared.loadTypescript(options.typescript.serverPath);

		(await import('./features/customFeatures')).register(connection, documents, () => projects);
		(await import('./features/languageFeatures')).register(ts, connection, documents, () => projects, options.languageFeatures);
		(await import('./registers/registerlanguageFeatures')).register(options.languageFeatures!, vue.getSemanticTokenLegend(), result.capabilities);

		connection.onInitialized(async () => {

			const inferredCompilerOptions = await getInferredCompilerOptions(ts, connection);
			const tsLocalized = options.typescript.localizedPath ? shared.loadTypescriptLocalized(options.typescript.localizedPath) : undefined;
			projects = createProjects(
				options,
				ts,
				tsLocalized,
				connection,
				documents,
				folders,
				inferredCompilerOptions,
			);

			if (params.capabilities.workspace?.didChangeConfiguration?.dynamicRegistration) { // TODO
				connection.onDidChangeConfiguration(() => updateConfigs(connection));
				connection.client.register(vscode.DidChangeConfigurationNotification.type);
			}
			updateConfigs(connection);
		});
	}

	return result;
}
