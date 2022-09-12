import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { FileSystemHost, LanguageServerPlugin, RuntimeEnvironment, ServerInitializationOptions } from './types';
import { createConfigurationHost } from './utils/configurationHost';
import { createDocumentServiceHost } from './utils/documentServiceHost';
import { createSnapshots } from './utils/snapshots';
import { createWorkspaces } from './utils/workspaces';

export function createLanguageServer(
	connection: vscode.Connection,
	runtimeEnv: RuntimeEnvironment,
	plugins: LanguageServerPlugin[],
) {

	let params: vscode.InitializeParams;
	let options: ServerInitializationOptions;
	let roots: URI[] = [];
	let fsHost: FileSystemHost | undefined;
	let projects: ReturnType<typeof createWorkspaces> | undefined;
	let documentServiceHost: ReturnType<typeof createDocumentServiceHost> | undefined;
	let configHost: ReturnType<typeof createConfigurationHost> | undefined;

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
		const ts = runtimeEnv.loadTypescript(options);

		configHost = params.capabilities.workspace?.configuration ? createConfigurationHost(params, connection) : undefined;

		if (options.documentFeatures) {

			(await import('./registers/registerDocumentFeatures')).register(options.documentFeatures, result.capabilities);

			documentServiceHost = createDocumentServiceHost(
				runtimeEnv,
				plugins,
				ts,
				configHost,
			);

			for (const root of roots) {
				documentServiceHost.add(root);
			}

			(await import('./features/documentFeatures')).register(connection, documents, documentServiceHost);
		}
		if (options.languageFeatures) {
			(await import('./registers/registerlanguageFeatures')).register(options.languageFeatures!, result.capabilities, plugins);

			fsHost = runtimeEnv.createFileSystemHost(ts, params.capabilities);

			const tsLocalized = runtimeEnv.loadTypescriptLocalized(options);

			projects = createWorkspaces(
				runtimeEnv,
				plugins,
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

			(await import('./features/customFeatures')).register(connection, projects, plugins);
			(await import('./features/languageFeatures')).register(connection, projects, options.languageFeatures, params);
		}

		try {
			// show version on LSP logs
			const packageJson = require('../package.json');
			result.serverInfo = {
				name: packageJson.name,
				version: packageJson.version,
			};
		} catch { }

		return result;
	});
	connection.onInitialized(async () => {

		fsHost?.ready(connection);
		configHost?.ready();

		if (params.capabilities.workspace?.workspaceFolders) {
			connection.workspace.onDidChangeWorkspaceFolders(e => {

				for (const folder of e.added) {
					documentServiceHost?.add(URI.parse(folder.uri));
					projects?.add(URI.parse(folder.uri));
				}

				for (const folder of e.removed) {
					documentServiceHost?.remove(URI.parse(folder.uri));
					projects?.remove(URI.parse(folder.uri));
				}
			});
		}
	});
	connection.listen();
}
