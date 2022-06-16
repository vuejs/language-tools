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
	schemaRequestHandlers: { [schema: string]: (uri: string, encoding?: BufferEncoding) => Promise<string>; },
	onDidChangeConfiguration?: (settings: any) => void,
	fileSystemProvide: FileSystemProvider | undefined,
}

export interface LanguageConfigs {
	definitelyExts: string[],
	indeterminateExts: string[],
	getDocumentService: typeof vue.getDocumentService,
	createLanguageService: typeof vue.createLanguageService,
}

export function createLanguageServer(
	connection: vscode.Connection,
	runtimeEnv: RuntimeEnvironment,
	languageConfigs: LanguageConfigs = {
		definitelyExts: ['.vue'],
		indeterminateExts: ['.md', '.html'],
		getDocumentService: vue.getDocumentService,
		createLanguageService: vue.createLanguageService,
	},
) {

	let clientCapabilities: vscode.ClientCapabilities;

	connection.onInitialize(async params => {

		const options: shared.ServerInitializationOptions = params.initializationOptions as any;
		clientCapabilities = params.capabilities;
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
		const ts = runtimeEnv.loadTypescript(options);
		const configHost = params.capabilities.workspace?.configuration ? createLsConfigs(folders, connection) : undefined;

		if (options.documentFeatures) {

			const documentService = languageConfigs.getDocumentService(
				{ typescript: ts },
				configHost,
				runtimeEnv.fileSystemProvide,
				loadCustomPlugins(folders[0]),
			);

			(await import('./features/documentFeatures')).register(connection, documents, documentService);
			(await import('./registers/registerDocumentFeatures')).register(options.documentFeatures, result.capabilities);
		}

		if (options.languageFeatures) {

			const tsLocalized = runtimeEnv.loadTypescriptLocalized(options);
			const projects = createProjects(
				runtimeEnv,
				languageConfigs,
				folders,
				ts,
				tsLocalized,
				options,
				documents,
				connection,
				configHost,
				() => getInferredCompilerOptions(ts, configuration),
			);

			(await import('./features/customFeatures')).register(connection, documents, projects);
			(await import('./features/languageFeatures')).register(ts, connection, documents, projects, options.languageFeatures, params, languageConfigs);
			(await import('./registers/registerlanguageFeatures')).register(options.languageFeatures!, vue.getSemanticTokenLegend(), result.capabilities, languageConfigs);
		}

		return result;
	});
	connection.onInitialized(() => {
		if (clientCapabilities.workspace?.didChangeConfiguration?.dynamicRegistration) { // TODO
			connection.client.register(vscode.DidChangeConfigurationNotification.type);
		}
	});
	connection.listen();

	const documents = new vscode.TextDocuments(TextDocument);
	documents.listen(connection);
}

export function loadCustomPlugins(dir: string) {
	try {
		const configPath = require.resolve('./volar.config.js', { paths: [dir] });
		const config: { plugins?: vue.EmbeddedLanguageServicePlugin[]; } = require(configPath);
		// console.warn('Found', configPath, 'and loaded', config.plugins?.length, 'plugins.');
		return config.plugins ?? [];
	}
	catch (err) {
		// console.warn('No volar.config.js found in', dir);
		return [];
	}
}
