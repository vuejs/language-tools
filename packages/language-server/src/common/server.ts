import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { FileSystemHost, LanguageServerInitializationOptions, LanguageServerPlugin, RuntimeEnvironment, ServerMode } from '../types';
import { createCancellationTokenHost } from './cancellationPipe';
import { createConfigurationHost } from './configurationHost';
import { createDocuments } from './documents';
import { createSyntaxServicesHost } from './syntaxServicesHost';
import { setupSemanticCapabilities, setupSyntacticCapabilities } from './utils/registerFeatures';
import { createWorkspaces } from './workspaces';

export interface ServerParams {
	connection: vscode.Connection,
	runtimeEnv: RuntimeEnvironment,
	plugins: LanguageServerPlugin[],
}

export function createCommonLanguageServer(params: ServerParams) {

	const { connection, runtimeEnv, plugins: _plugins } = params;

	let initParams: vscode.InitializeParams;
	let options: LanguageServerInitializationOptions;
	let roots: URI[] = [];
	let fsHost: FileSystemHost | undefined;
	let projects: ReturnType<typeof createWorkspaces> | undefined;
	let documentServiceHost: ReturnType<typeof createSyntaxServicesHost> | undefined;
	let configurationHost: ReturnType<typeof createConfigurationHost> | undefined;
	let plugins: ReturnType<LanguageServerPlugin>[];

	const documents = createDocuments(connection);

	connection.onInitialize(async _params => {

		initParams = _params;
		options = initParams.initializationOptions;
		plugins = _plugins.map(plugin => plugin(options));

		if (initParams.capabilities.workspace?.workspaceFolders && initParams.workspaceFolders) {
			roots = initParams.workspaceFolders.map(folder => URI.parse(folder.uri));
		}
		else if (initParams.rootUri) {
			roots = [URI.parse(initParams.rootUri)];
		}
		else if (initParams.rootPath) {
			roots = [URI.file(initParams.rootPath)];
		}

		const result: vscode.InitializeResult = {
			capabilities: {
				textDocumentSync: (options.textDocumentSync as vscode.TextDocumentSyncKind) ?? vscode.TextDocumentSyncKind.Incremental,
			},
		};

		configurationHost = initParams.capabilities.workspace?.configuration ? createConfigurationHost(initParams, connection) : undefined;

		const serverMode = options.serverMode ?? ServerMode.Semantic;

		setupSyntacticCapabilities(initParams.capabilities, result.capabilities, options);
		await _createDocumentServiceHost();

		if (serverMode === ServerMode.Semantic) {
			setupSemanticCapabilities(initParams.capabilities, result.capabilities, options, plugins, getSemanticTokensLegend());
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
	connection.onInitialized(() => {

		fsHost?.ready(connection);
		configurationHost?.ready();

		if (initParams.capabilities.workspace?.workspaceFolders) {
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

		if (
			options.serverMode !== ServerMode.Syntactic
			&& !options.disableFileWatcher
			&& initParams.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration
		) {
			connection.client.register(vscode.DidChangeWatchedFilesNotification.type, {
				watchers: [
					...plugins.map(plugin => plugin.extraFileExtensions.map(ext => ({ globPattern: `**/*.${ext.extension}` }))).flat(),
					{
						globPattern: `**/*.{${[
							'js',
							'cjs',
							'mjs',
							'ts',
							'cts',
							'mts',
							'jsx',
							'tsx',
							'json',
							...plugins.map(plugin => plugin.extraFileExtensions.map(ext => ext.extension)).flat(),
						].join(',')}}`
					},
				]
			});
		}
	});
	connection.listen();

	async function _createDocumentServiceHost() {

		const ts = runtimeEnv.loadTypescript(options.typescript.tsdk);

		documentServiceHost = createSyntaxServicesHost(
			runtimeEnv,
			plugins,
			ts,
			configurationHost,
			options,
		);

		for (const root of roots) {
			documentServiceHost.add(root);
		}

		(await import('./features/documentFeatures')).register(
			connection,
			documents,
			documentServiceHost,
		);

		for (const plugin of plugins) {
			plugin.syntacticService?.onInitialize?.(connection);
		}
	}

	async function createLanguageServiceHost() {

		const ts = runtimeEnv.loadTypescript(options.typescript.tsdk);
		fsHost = runtimeEnv.createFileSystemHost(ts, initParams.capabilities);

		const tsLocalized = initParams.locale ? await runtimeEnv.loadTypescriptLocalized(options.typescript.tsdk, initParams.locale) : undefined;
		const cancelTokenHost = createCancellationTokenHost(options.cancellationPipeName);
		const _projects = createWorkspaces({
			server: params,
			fileSystemHost: fsHost,
			configurationHost,
			ts,
			tsLocalized,
			initParams: initParams,
			initOptions: options,
			documents,
			cancelTokenHost,
			plugins,
		});
		projects = _projects;

		for (const root of roots) {
			projects.add(root);
		}

		(await import('./features/customFeatures')).register(connection, projects);
		(await import('./features/languageFeatures')).register(connection, projects, initParams, cancelTokenHost, getSemanticTokensLegend());

		for (const plugin of plugins) {
			plugin.semanticService?.onInitialize?.(connection, getLanguageService as any);
		}

		async function getLanguageService(uri: string) {
			const project = (await projects!.getProject(uri))?.project;
			return project?.getLanguageService();
		}
	}

	function getSemanticTokensLegend() {
		if (!options.semanticTokensLegend) {
			return standardSemanticTokensLegend;
		}
		return {
			tokenTypes: [...standardSemanticTokensLegend.tokenTypes, ...options.semanticTokensLegend.tokenTypes],
			tokenModifiers: [...standardSemanticTokensLegend.tokenModifiers, ...options.semanticTokensLegend.tokenModifiers],
		};
	}
}

// https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide#standard-token-types-and-modifiers
const standardSemanticTokensLegend: vscode.SemanticTokensLegend = {
	tokenTypes: [
		'namespace',
		'class',
		'enum',
		'interface',
		'struct',
		'typeParameter',
		'type',
		'parameter',
		'variable',
		'property',
		'enumMember',
		'decorator',
		'event',
		'function',
		'method',
		'macro',
		'label',
		'comment',
		'string',
		'keyword',
		'number',
		'regexp',
		'operator',
	],
	tokenModifiers: [
		'declaration',
		'definition',
		'readonly',
		'static',
		'deprecated',
		'abstract',
		'async',
		'modification',
		'documentation',
		'defaultLibrary',
	],
};
