import * as shared from '@volar/shared';
import * as vue from '@volar/vue-language-service';
import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { LanguageConfigs, RuntimeEnvironment } from './types';
import { createLsConfigs } from './utils/configHost';
import { getInferredCompilerOptions } from './utils/inferredCompilerOptions';
import { createSnapshots } from './utils/snapshots';
import { createWorkspaces } from './utils/workspaces';

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
	let projects: ReturnType<typeof createWorkspaces>;

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
				ts,
				configHost,
				runtimeEnv.fileSystemProvide,
				loadCustomPlugins(folders[0]),
			);

			(await import('./features/documentFeatures')).register(connection, documents, documentService, options.documentFeatures.allowedLanguageIds);
			(await import('./registers/registerDocumentFeatures')).register(options.documentFeatures, result.capabilities);
		}

		if (options.languageFeatures) {

			const tsLocalized = runtimeEnv.loadTypescriptLocalized(options);
			projects = createWorkspaces(
				runtimeEnv,
				languageConfigs,
				ts,
				tsLocalized,
				options,
				documents,
				connection,
				configHost,
				() => getInferredCompilerOptions(ts, configuration),
				params.capabilities,
			);

			for (const root of folders) {
				projects.add(root);
			}

			(await import('./features/customFeatures')).register(connection, projects);
			(await import('./features/languageFeatures')).register(connection, projects, options.languageFeatures, params);
			(await import('./registers/registerlanguageFeatures')).register(options.languageFeatures!, vue.getSemanticTokenLegend(), result.capabilities, languageConfigs);
		}

		return result;
	});
	connection.onInitialized(() => {

		if (clientCapabilities.workspace?.didChangeConfiguration?.dynamicRegistration) { // TODO
			connection.client.register(vscode.DidChangeConfigurationNotification.type);
		}

		connection.workspace.onDidChangeWorkspaceFolders(e => {

			const added = e.added.map(folder => URI.parse(folder.uri)).filter(uri => uri.scheme === 'file').map(uri => uri.fsPath);
			const removed = e.removed.map(folder => URI.parse(folder.uri)).filter(uri => uri.scheme === 'file').map(uri => uri.fsPath);

			for (const folder of added) {
				projects.add(folder);
			}
			for (const folder of removed) {
				projects.remove(folder);
			}
		});
	});
	connection.listen();

	const documents = createSnapshots(connection);
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
