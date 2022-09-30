import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { FileSystemHost, LanguageServerPlugin, ServerMode, RuntimeEnvironment, InitializationOptions } from './types';
import { createConfigurationHost } from './utils/configurationHost';
import { createDocumentServiceHost } from './utils/documentServiceHost';
import { createSnapshots } from './utils/snapshots';
import { createWorkspaces } from './utils/workspaces';
import { setupSemanticCapabilities, setupSyntacticCapabilities } from './registerFeatures';

export function createCommonLanguageServer(
	connection: vscode.Connection,
	runtimeEnv: RuntimeEnvironment,
	_plugins: LanguageServerPlugin[],
) {

	let params: vscode.InitializeParams;
	let options: InitializationOptions;
	let roots: URI[] = [];
	let fsHost: FileSystemHost | undefined;
	let projects: ReturnType<typeof createWorkspaces> | undefined;
	let documentServiceHost: ReturnType<typeof createDocumentServiceHost> | undefined;
	let configHost: ReturnType<typeof createConfigurationHost> | undefined;
	let plugins: ReturnType<LanguageServerPlugin>[];

	const documents = createSnapshots(connection);

	connection.onInitialize(async _params => {

		params = _params;
		options = params.initializationOptions as any;
		plugins = _plugins.map(plugin => plugin(options));

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

		configHost = params.capabilities.workspace?.configuration ? createConfigurationHost(params, connection) : undefined;

		const serverMode = options.serverMode ?? ServerMode.Semantic;

		setupSyntacticCapabilities(params.capabilities, result.capabilities);
		await createDocumenntServiceHost();

		if (serverMode === ServerMode.Semantic) {
			setupSemanticCapabilities(params.capabilities, result.capabilities, options, plugins);
			await createLanguageServiceHost();
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

	async function createDocumenntServiceHost() {

		const ts = runtimeEnv.loadTypescript(options.typescript.tsdk);

		documentServiceHost = createDocumentServiceHost(
			runtimeEnv,
			plugins,
			ts,
			configHost,
		);

		for (const root of roots) {
			documentServiceHost.add(root);
		}

		(await import('./features/documentFeatures')).register(
			connection,
			documents,
			documentServiceHost,
		);
	}

	async function createLanguageServiceHost() {

		const ts = runtimeEnv.loadTypescript(options.typescript.tsdk);
		fsHost = runtimeEnv.createFileSystemHost(ts, params.capabilities);

		const tsLocalized = params.locale ? runtimeEnv.loadTypescriptLocalized(options.typescript.tsdk, params.locale) : undefined;
		const _projects = createWorkspaces(
			runtimeEnv,
			plugins,
			fsHost,
			configHost,
			ts,
			tsLocalized,
			params.capabilities,
			options,
			documents,
			connection,
		);
		projects = _projects;

		for (const root of roots) {
			projects.add(root);
		}

		(await import('./features/customFeatures')).register(connection, projects);
		(await import('./features/languageFeatures')).register(connection, projects, params);

		for (const plugin of plugins) {
			plugin.languageService?.onInitialize?.(connection, getLanguageService as any);
		}

		async function getLanguageService(uri: string) {
			const project = (await projects!.getProject(uri))?.project;
			return project?.getLanguageService();
		}
	}
}
