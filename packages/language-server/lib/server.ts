import type { LanguageServer } from '@volar/language-server';
import { createLanguageServiceEnvironment } from '@volar/language-server/lib/project/simpleProject';
import { createConnection, createServer } from '@volar/language-server/node';
import type { MapperOptions } from '@vue/content-mapper/protocol';
import { resolveVueCompilerOptions } from '@vue/content-mapper/vueOptions';
import {
	createLanguage,
	createParsedCommandLine,
	createParsedCommandLineByJson,
	createVueLanguagePlugin,
	getAllExtensions,
	type LanguagePlugin,
	resolveContentMappers,
} from '@vue/language-core';
import {
	createLanguageService,
	createUriMap,
	createVueLanguageServicePlugins,
	type LanguageService,
} from '@vue/language-service';
import type * as ts from 'typescript';
import { URI } from 'vscode-uri';
import { resolveModuleName } from './moduleResolution';
import { connectTypeScriptProjectResolver, type TypeScriptProjectResolver } from './typescriptProject';

/** A `contentMappers[]` entry, as written in a tsconfig or contributed for inferred projects. */
interface ContentMapperEntry {
	package: string;
	extensions: string[];
	options?: MapperOptions;
}

/**
 * Result of the `vue/typescriptApiConnection` request the server sends to the client. The client forwards
 * `custom/initializeAPISession` to the editor's TypeScript language server and returns the pipe it opened,
 * along with the `package.json` of the TS 7 installation that server runs.
 */
interface TypeScriptApiConnection {
	pipe: string;
	packageJsonPath: string;
}

export function startServer(ts: typeof import('typescript')) {
	const connection = createConnection();
	const server = createServer(connection);
	const tsserverRequestHandlers = new Map<number, (res: any) => void>();

	let tsserverRequestId = 0;
	let typescriptApi: Promise<TypeScriptProjectResolver> | undefined;

	connection.listen();

	connection.onNotification('tsserver/response', ([id, res]) => {
		tsserverRequestHandlers.get(id)?.(res);
		tsserverRequestHandlers.delete(id);
	});

	function connectTypeScriptApi() {
		return typescriptApi ??= connection.sendRequest<TypeScriptApiConnection>('vue/typescriptApiConnection').then(
			({ pipe, packageJsonPath }) => connectTypeScriptProjectResolver(pipe, packageJsonPath),
		).catch(error => {
			connection.window.showErrorMessage(
				`Vue: cannot connect to the TypeScript 7 language server (${error?.message ?? error}). `
					+ 'Restart the Vue language server once it is available.',
			);
			throw error;
		});
	}

	/** The file's default project in the TypeScript language server; asks the client for a new pipe once if the current one stopped working. */
	async function getTypeScriptProject(fileName: string) {
		const current = connectTypeScriptApi();
		try {
			return await (await current).getProject(fileName);
		}
		catch {
			// the TypeScript language server restarted or went away
			if (typescriptApi === current) {
				typescriptApi = undefined;
				void current.then(resolver => resolver.dispose(), () => {});
			}
			return await (await connectTypeScriptApi()).getProject(fileName);
		}
	}

	connection.onInitialize(params => {
		const tsconfigProjects = createUriMap<LanguageService>();
		// The content mappers the client registers for files outside any tsconfig.
		const inferredContentMappers: ContentMapperEntry[] | undefined = params.initializationOptions?.contentMappers;

		server.fileWatcher.onDidChangeWatchedFiles(({ changes }) => {
			for (const change of changes) {
				const changeUri = URI.parse(change.uri);
				if (tsconfigProjects.has(changeUri)) {
					tsconfigProjects.get(changeUri)!.dispose();
					tsconfigProjects.delete(changeUri);
				}
			}
		});

		server.documents.onDidClose(({ document }) => {
			const uri = URI.parse(document.uri);
			if (uri.scheme === 'file') {
				void typescriptApi?.then(resolver => resolver.closeFile(uri.fsPath.replace(/\\/g, '/')), () => {});
			}
		});

		let simpleLanguageService: LanguageService | undefined;

		const result = server.initialize(
			params,
			{
				setup() {},
				async getLanguageService(uri) {
					if (uri.scheme === 'file') {
						const fileName = uri.fsPath.replace(/\\/g, '/');
						const configFileName = (await getTypeScriptProject(fileName))?.configFileName;
						if (configFileName) {
							let languageService = tsconfigProjects.get(URI.file(configFileName));
							if (!languageService) {
								languageService = createProjectLanguageService(server, configFileName);
								tsconfigProjects.set(URI.file(configFileName), languageService);
							}
							return languageService;
						}
					}
					return simpleLanguageService ??= createProjectLanguageService(server, undefined);
				},
				getExistingLanguageServices() {
					const projects = [...tsconfigProjects.values()];
					if (simpleLanguageService) {
						projects.push(simpleLanguageService);
					}
					return projects;
				},
				reload() {
					for (const languageService of tsconfigProjects.values()) {
						languageService.dispose();
					}
					tsconfigProjects.clear();
					if (simpleLanguageService) {
						simpleLanguageService.dispose();
						simpleLanguageService = undefined;
					}
				},
			},
			createVueLanguageServicePlugins(ts, {
				collectExtractProps(...args) {
					return sendTsServerRequest('_vue:collectExtractProps', args);
				},
				getComponentDirectives(...args) {
					return sendTsServerRequest('_vue:getComponentDirectives', args);
				},
				getComponentMeta(...args) {
					return sendTsServerRequest('_vue:getComponentMeta', args);
				},
				getComponentNames(...args) {
					return sendTsServerRequest('_vue:getComponentNames', args);
				},
				getComponentProps(...args) {
					return sendTsServerRequest('_vue:getComponentProps', args);
				},
				getComponentSlots(...args) {
					return sendTsServerRequest('_vue:getComponentSlots', args);
				},
				getElementAttrs(...args) {
					return sendTsServerRequest('_vue:getElementAttrs', args);
				},
				getElementNames(...args) {
					return sendTsServerRequest('_vue:getElementNames', args);
				},
				getImportPathForFile(...args) {
					return sendTsServerRequest('_vue:getImportPathForFile', args);
				},
				getAutoImportSuggestions(...args) {
					return sendTsServerRequest('_vue:getAutoImportSuggestions', args);
				},
				resolveAutoImportCompletionEntry(...args) {
					return sendTsServerRequest('_vue:resolveAutoImportCompletionEntry', args);
				},
				isRefAtPosition(...args) {
					return sendTsServerRequest('_vue:isRefAtPosition', args);
				},
				async resolveModuleName(fileName, moduleName, allowNonExistent) {
					return resolveModuleName(
						ts,
						(await getTypeScriptProject(fileName))?.parsedCommandLine.options ?? {},
						fileName,
						moduleName,
						allowNonExistent,
					);
				},
				getDocumentHighlights(fileName, position) {
					return sendTsServerRequest(
						'_vue:documentHighlights-full',
						{
							file: fileName,
							...{ position } as unknown as { line: number; offset: number },
							filesToSearch: [fileName],
						} satisfies ts.server.protocol.DocumentHighlightsRequestArgs,
					);
				},
				async getQuickInfoAtPosition(fileName, { line, character }) {
					const result = await sendTsServerRequest<ts.server.protocol.QuickInfoResponseBody>(
						'_vue:' + ts.server.protocol.CommandTypes.Quickinfo,
						{
							file: fileName,
							line: line + 1,
							offset: character + 1,
						} satisfies ts.server.protocol.FileLocationRequestArgs,
					);
					return result?.displayString;
				},
			}),
		);

		const packageJson = require('../package.json');
		result.serverInfo = {
			name: packageJson.name,
			version: packageJson.version,
		};

		return result;

		async function sendTsServerRequest<T>(command: string, args: any): Promise<T | null> {
			return await new Promise<T | null>(resolve => {
				const requestId = ++tsserverRequestId;
				tsserverRequestHandlers.set(requestId, resolve);
				connection.sendNotification('tsserver/request', [requestId, command, args]);
			});
		}

		function createProjectLanguageService(server: LanguageServer, tsconfig: string | undefined) {
			const configFileName = tsconfig && !ts.server.isInferredProjectName(tsconfig) ? tsconfig : undefined;
			const commonLine = configFileName
				? createParsedCommandLine(ts, ts.sys, configFileName)
				: createParsedCommandLineByJson(ts, ts.sys, ts.sys.getCurrentDirectory(), {});
			const asFileName = (uri: URI) => uri.fsPath.replace(/\\/g, '/');
			const entries = (configFileName
				? resolveContentMappers(ts, ts.sys, configFileName) as ContentMapperEntry[] | undefined
				: inferredContentMappers)
				?.filter(entry => entry.package === '@vue/content-mapper');
			const vuePlugins = entries?.length
				? entries.map(entry =>
					routeByExtensions(
						createVueLanguagePlugin(
							ts,
							commonLine.options,
							resolveVueCompilerOptions(ts, ts.sys, configFileName, entry.options).vueOptions,
							asFileName,
						),
						entry.extensions,
					)
				)
				: [
					routeByExtensions(
						createVueLanguagePlugin(ts, commonLine.options, commonLine.vueOptions, asFileName),
						getAllExtensions(commonLine.vueOptions),
					),
				];
			const language = createLanguage<URI>(
				[
					{
						getLanguageId: uri => server.documents.get(uri)?.languageId,
					},
					...vuePlugins,
				],
				createUriMap(),
				uri => {
					const document = server.documents.get(uri);
					if (document) {
						language.scripts.set(uri, document.getSnapshot(), document.languageId);
					}
					else {
						language.scripts.delete(uri);
					}
				},
			);
			return createLanguageService(
				language,
				server.languageServicePlugins,
				createLanguageServiceEnvironment(server, [...server.workspaceFolders.all]),
				{},
			);

			/** Like the TypeScript host, hands the Vue plugin only the files matching `extensions`. */
			function routeByExtensions(plugin: LanguagePlugin<URI>, extensions: string[]): LanguagePlugin<URI> {
				const isContentMapperFile = (uri: URI) => extensions.some(extension => asFileName(uri).endsWith(extension));
				return {
					...plugin,
					getLanguageId: uri => isContentMapperFile(uri) ? plugin.getLanguageId(uri) : undefined,
					createVirtualCode: (uri, languageId, snapshot, ctx) =>
						isContentMapperFile(uri) ? plugin.createVirtualCode!(uri, languageId, snapshot, ctx) : undefined,
				};
			}
		}
	});

	connection.onInitialized(server.initialized);

	connection.onShutdown(server.shutdown);
}
