import * as shared from '@volar/shared';
import * as fs from 'fs';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'upath';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import * as vue from 'vscode-vue-languageservice';
import { createLsConfigs } from './configs';
import { getInferredCompilerOptions } from './inferredCompilerOptions';
import { createProjects } from './projects';
import * as tsConfigs from './tsConfigs';

const connection = vscode.createConnection(vscode.ProposedFeatures.all);
connection.onInitialize(onInitialize);
connection.listen();

const documents = new vscode.TextDocuments(TextDocument);
documents.listen(connection);

let inited = false;
connection.onRequest(shared.InitDoneRequest.type, async () => {
	while (!inited) {
		await shared.sleep(100);
	}
	return undefined;
});
connection.onRequest(shared.DepsRequest.type, () => Object.keys(require.cache));

async function onInitialize(params: vscode.InitializeParams) {

	const options: shared.ServerInitializationOptions = params.initializationOptions;
	let folders: string[] = [];
	let rootUri: URI;

	if (params.capabilities.workspace?.workspaceFolders && params.workspaceFolders) {
		folders = params.workspaceFolders
			.map(folder => URI.parse(folder.uri))
			.filter(uri => uri.scheme === 'file')
			.map(uri => uri.fsPath);
	}
	else if (params.rootUri && (rootUri = URI.parse(params.rootUri)).scheme === 'file') {
		folders = [rootUri.fsPath];
	}
	else if (params.rootPath) {
		folders = [params.rootPath];
	}

	const result: vscode.InitializeResult = {
		capabilities: {
			textDocumentSync: vscode.TextDocumentSyncKind.Incremental,
		},
	};
	const configuration = params.capabilities.workspace?.configuration ? connection.workspace : undefined;

	if (options.documentFeatures) {

		const ts = loadTypescript(options.typescript.serverPath);
		const formatters = await import('./formatters');
		const noStateLs = vue.getDocumentLanguageService(
			{ typescript: ts },
			(document) => tsConfigs.getPreferences(configuration, document),
			(document, options) => tsConfigs.getFormatOptions(configuration, document, options),
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
		const lsConfigs = params.capabilities.workspace?.configuration ? createLsConfigs(connection) : undefined;

		const ts = loadTypescript(options.typescript.serverPath);

		(await import('./features/customFeatures')).register(connection, documents, () => projects);
		(await import('./features/languageFeatures')).register(ts, connection, configuration, documents, () => projects, options.languageFeatures, lsConfigs, params);
		(await import('./registers/registerlanguageFeatures')).register(options.languageFeatures!, vue.getSemanticTokenLegend(), result.capabilities, ts.version);

		connection.onInitialized(async () => {

			const inferredCompilerOptions = await getInferredCompilerOptions(ts, configuration);
			const tsLocalized = options.typescript.localizedPath ? loadTypescriptLocalized(options.typescript.localizedPath) : undefined;

			if (params.capabilities.workspace?.didChangeConfiguration?.dynamicRegistration) { // TODO
				connection.client.register(vscode.DidChangeConfigurationNotification.type);
			}

			projects = createProjects(
				options,
				ts,
				tsLocalized,
				connection,
				documents,
				folders,
				inferredCompilerOptions,
				lsConfigs,
				() => inited = true,
			);
		});
	}
	else {
		inited = true;
	}

	return result;
}

function loadTypescript(tsPath: string): typeof import('typescript/lib/tsserverlibrary') {
	return require(path.toUnix(tsPath));
}

function loadTypescriptLocalized(tsPath: string): ts.MapLike<string> | undefined {
	if (fs.existsSync(tsPath)) {
		return require(path.toUnix(tsPath));
	}
}
