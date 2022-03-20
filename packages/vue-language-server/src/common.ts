import * as shared from '@volar/shared';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import * as vue from '@volar/vue-language-service';
import { createLsConfigs } from './configHost';
import { getInferredCompilerOptions } from './inferredCompilerOptions';
import { createProjects } from './projects';
import type { FileSystemProvider } from 'vscode-html-languageservice';

export interface RuntimeEnvironment {
	loadTypescript: (initOptions: shared.ServerInitializationOptions) => typeof import('typescript/lib/tsserverlibrary'),
	loadTypescriptLocalized: (initOptions: shared.ServerInitializationOptions) => any,
	schemaRequestHandlers: { [schema: string]: (uri: string, encoding?: BufferEncoding) => Promise<string> },
	onDidChangeConfiguration?: (settings: any) => void,
	fileSystemProvide: FileSystemProvider | undefined,
}

export function createLanguageServer(connection: vscode.Connection, runtimeEnv: RuntimeEnvironment) {

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

	async function onInitialize(params: vscode.InitializeParams) {

		const options: shared.ServerInitializationOptions = params.initializationOptions as any;
		let folderUris: string[] = [];

		if (params.capabilities.workspace?.workspaceFolders && params.workspaceFolders) {
			folderUris = params.workspaceFolders.map(folder => folder.uri);
		}
		else if (params.rootUri) {
			folderUris = [params.rootUri];
		}
		else if (params.rootPath) {
			folderUris = [URI.file(params.rootPath).toString()];
		}

		const result: vscode.InitializeResult = {
			capabilities: {
				textDocumentSync: vscode.TextDocumentSyncKind.Incremental,
			},
		};
		const configuration = params.capabilities.workspace?.configuration ? connection.workspace : undefined;

		if (options.documentFeatures) {

			const configHost = params.capabilities.workspace?.configuration ? createLsConfigs(folderUris, connection) : undefined;
			const ts = runtimeEnv.loadTypescript(options);
			const documentService = vue.getDocumentService(
				{ typescript: ts },
				async (uri) => {
					if (options.documentFeatures?.documentFormatting?.getDocumentPrintWidthRequest) {
						const response = await connection.sendRequest(shared.GetDocumentPrintWidthRequest.type, { uri });
						if (response !== undefined) {
							return response;
						}
					}
					return options.documentFeatures?.documentFormatting?.defaultPrintWidth ?? 100;
				},
				configHost,
				runtimeEnv.fileSystemProvide,
				loadCustomPlugins(folderUris[0]),
			);

			(await import('./features/documentFeatures')).register(connection, documents, documentService);
			(await import('./registers/registerDocumentFeatures')).register(options.documentFeatures, result.capabilities);
		}

		if (options.languageFeatures) {

			let projects: ReturnType<typeof createProjects> | undefined;
			const lsConfigs = params.capabilities.workspace?.configuration ? createLsConfigs(folderUris, connection) : undefined;

			const ts = runtimeEnv.loadTypescript(options);

			(await import('./features/customFeatures')).register(connection, documents, () => projects);
			(await import('./features/languageFeatures')).register(ts, connection, documents, () => projects, options.languageFeatures, params);
			(await import('./registers/registerlanguageFeatures')).register(options.languageFeatures!, vue.getSemanticTokenLegend(), result.capabilities, ts.version);

			connection.onInitialized(async () => {

				const inferredCompilerOptions = await getInferredCompilerOptions(ts, configuration);
				const tsLocalized = runtimeEnv.loadTypescriptLocalized(options);

				if (params.capabilities.workspace?.didChangeConfiguration?.dynamicRegistration) { // TODO
					connection.client.register(vscode.DidChangeConfigurationNotification.type);
				}

				projects = createProjects(
					runtimeEnv,
					folderUris,
					ts,
					tsLocalized,
					options,
					documents,
					connection,
					lsConfigs,
					inferredCompilerOptions,
				);

				inited = true;
			});
		}
		else {
			inited = true;
		}

		return result;
	}
}

export function loadCustomPlugins(dirUri: string) {
	const dir = URI.parse(dirUri).fsPath; // TODO: check scheme
	try {
		const configPath = require.resolve('./volar.config.js', { paths: [dir] });
		const config: { plugins?: vue.EmbeddedLanguageServicePlugin[] } = require(configPath);
		return config.plugins ?? []
	}
	catch (err) {
		console.warn('load volar.config.js failed in', dir);
		return [];
	}
}
