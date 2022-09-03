import * as vue from '@volar/vue-language-service';
import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { FileSystemHost, LanguageConfigs, RuntimeEnvironment, ServerInitializationOptions } from './types';
import { createConfigurationHost } from './utils/configurationHost';
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

	let params: vscode.InitializeParams;
	let options: ServerInitializationOptions;
	let folders: string[] = [];
	let fsHost: FileSystemHost;

	connection.onInitialize(async _params => {

		params = _params;
		options = params.initializationOptions as any;
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

		if (options.documentFeatures) {
			(await import('./registers/registerDocumentFeatures')).register(options.documentFeatures, result.capabilities);
		}
		if (options.languageFeatures) {
			(await import('./registers/registerlanguageFeatures')).register(options.languageFeatures!, vue.getSemanticTokenLegend(), result.capabilities, languageConfigs);

			const ts = runtimeEnv.loadTypescript(options);
			fsHost = runtimeEnv.createFileSystemHost(ts, connection, params.capabilities);
			await fsHost.init?.();
		}

		return result;
	});
	connection.onInitialized(async () => {

		const configHost = params.capabilities.workspace?.configuration ? createConfigurationHost(folders, connection) : undefined;
		const ts = runtimeEnv.loadTypescript(options);

		if (options.documentFeatures) {

			const documentService = languageConfigs.getDocumentService(
				ts,
				configHost,
				runtimeEnv.fileSystemProvide,
				loadCustomPlugins(folders[0]),
			);

			(await import('./features/documentFeatures')).register(connection, documents, documentService, options.documentFeatures.allowedLanguageIds);
		}

		if (options.languageFeatures) {

			const tsLocalized = runtimeEnv.loadTypescriptLocalized(options);
			const projects = createWorkspaces(
				runtimeEnv,
				languageConfigs,
				fsHost,
				configHost,
				ts,
				tsLocalized,
				options,
				documents,
				connection,
			);

			for (const root of folders) {
				projects.add(root);
			}

			(await import('./features/customFeatures')).register(connection, projects);
			(await import('./features/languageFeatures')).register(connection, projects, options.languageFeatures, params);

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
		}

		if (params.capabilities.workspace?.didChangeConfiguration?.dynamicRegistration) { // TODO
			connection.client.register(vscode.DidChangeConfigurationNotification.type);
		}
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
