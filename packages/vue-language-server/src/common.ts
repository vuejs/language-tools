import * as vue from '@volar/vue-language-service';
import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { FileSystemHost, LanguageConfigs, RuntimeEnvironment, ServerInitializationOptions } from './types';
import { createConfigurationHost } from './utils/configurationHost';
import { createDocumentServiceHost } from './utils/documentServiceHost';
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
	let roots: URI[] = [];
	let fsHost: FileSystemHost | undefined;
	let projects: ReturnType<typeof createWorkspaces> | undefined;
	let documentServiceHost: ReturnType<typeof createDocumentServiceHost> | undefined;

	const documents = createSnapshots(connection);

	connection.onInitialize(async _params => {

		params = _params;
		options = params.initializationOptions as any;

		if (params.capabilities.workspace?.workspaceFolders && params.workspaceFolders) {
			roots = params.workspaceFolders.map(folder => URI.parse(folder.uri));
		}
		else if (params.rootUri) {
			roots = [URI.parse(params.rootUri)];
		}
		else if (params.rootPath) {
			roots = [URI.file(params.rootPath)];
		}

		const result: vscode.InitializeResult = {
			capabilities: {
				textDocumentSync: (options.textDocumentSync as vscode.TextDocumentSyncKind) ?? vscode.TextDocumentSyncKind.Incremental,
			},
		};
		const configHost = params.capabilities.workspace?.configuration ? createConfigurationHost(roots, connection) : undefined;
		const ts = runtimeEnv.loadTypescript(options);

		if (options.documentFeatures) {

			(await import('./registers/registerDocumentFeatures')).register(options.documentFeatures, result.capabilities);

			documentServiceHost = createDocumentServiceHost(
				runtimeEnv,
				languageConfigs,
				ts,
				configHost,
			);

			for (const root of roots) {
				documentServiceHost.add(root.toString());
			}

			(await import('./features/documentFeatures')).register(connection, documents, documentServiceHost, options.documentFeatures.allowedLanguageIds);
		}
		if (options.languageFeatures) {
			(await import('./registers/registerlanguageFeatures')).register(options.languageFeatures!, vue.getSemanticTokenLegend(), result.capabilities, languageConfigs);

			fsHost = runtimeEnv.createFileSystemHost(ts, params.capabilities);

			const tsLocalized = runtimeEnv.loadTypescriptLocalized(options);

			projects = createWorkspaces(
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

			for (const root of roots) {
				projects.add(root);
			}

			(await import('./features/customFeatures')).register(connection, projects);
			(await import('./features/languageFeatures')).register(connection, projects, options.languageFeatures, params);
		}

		return result;
	});
	connection.onInitialized(async () => {

		fsHost?.ready(connection);

		connection.workspace.onDidChangeWorkspaceFolders(e => {

			for (const folder of e.added) {
				documentServiceHost?.add(folder.uri);
				projects?.add(URI.parse(folder.uri));
			}

			for (const folder of e.removed) {
				documentServiceHost?.remove(folder.uri);
				projects?.remove(URI.parse(folder.uri));
			}
		});

		if (params.capabilities.workspace?.didChangeConfiguration?.dynamicRegistration) { // TODO
			connection.client.register(vscode.DidChangeConfigurationNotification.type);
		}
	});
	connection.listen();
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
