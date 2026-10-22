import type { LanguageServer, MessageActionItem } from '@volar/language-server';
import { createLanguageServiceEnvironment } from '@volar/language-server/lib/project/simpleProject';
import { createConnection, createServer } from '@volar/language-server/node';
import type { MapperOptions } from '@vue/content-mapper/protocol';
import { resolveVueCompilerOptions } from '@vue/content-mapper/vueOptions';
import { createLanguage, createVueLanguagePlugin, type LanguagePlugin, VueVirtualCode } from '@vue/language-core';
import {
	createLanguageService,
	createUriMap,
	createVueLanguageServicePlugins,
	type LanguageService,
} from '@vue/language-service';
import { URI } from 'vscode-uri';
import {
	connectTypeScriptProjectResolver,
	type TypeScriptProject,
	type TypeScriptProjectResolver,
} from './typescriptProject';

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

	/** A failed acquisition is reported once and not cached, so the next request asks the client again. */
	function connectTypeScriptApi() {
		if (!typescriptApi) {
			const connecting = connection.sendRequest<TypeScriptApiConnection>('vue/typescriptApiConnection').then(
				({ pipe, packageJsonPath }) => connectTypeScriptProjectResolver(pipe, packageJsonPath),
			);
			typescriptApi = connecting;
			connecting.catch(error => {
				if (typescriptApi === connecting) {
					typescriptApi = undefined;
				}
				// Sent as a request even without actions (the type argument selects the overload that admits it);
				// a client may fail to answer it, and an unhandled rejection would end the server.
				connection.window.showErrorMessage<MessageActionItem>(
					`Vue: cannot connect to the TypeScript 7 language server (${error?.message ?? error}). `
						+ 'Vue will try again on the next request.',
				).catch(() => {});
			});
		}
		return typescriptApi;
	}

	/** The file's default project in the TypeScript language server; asks the client for a new pipe once if the current one stopped working. */
	async function getTypeScriptProject(fileName: string) {
		const current = connectTypeScriptApi();
		const resolver = await current;
		try {
			return await resolver.getProject(fileName);
		}
		catch {
			// the TypeScript language server restarted or went away
			if (typescriptApi === current) {
				typescriptApi = undefined;
				resolver.dispose();
			}
			return await (await connectTypeScriptApi()).getProject(fileName);
		}
	}

	connection.onInitialize(params => {
		const tsconfigProjects = createUriMap<LanguageService>();
		// The content mappers the client registers for files outside any tsconfig.
		const inferredContentMappers: ContentMapperEntry[] | undefined = params.initializationOptions?.contentMappers;

		// Any JSON file may be a config or one it extends. The rebuilt services ask again with `openFiles`, which
		// makes the TypeScript language server apply the change notifications the editor already sent it.
		server.fileWatcher.onDidChangeWatchedFiles(({ changes }) => {
			if (changes.some(change => change.uri.endsWith('.json'))) {
				for (const languageService of tsconfigProjects.values()) {
					languageService.dispose();
				}
				tsconfigProjects.clear();
				void typescriptApi?.then(resolver => resolver.invalidate(), () => {});
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
					const project = uri.scheme === 'file'
						? await getTypeScriptProject(uri.fsPath.replace(/\\/g, '/'))
						: undefined;
					if (project?.configFileName) {
						let languageService = tsconfigProjects.get(URI.file(project.configFileName));
						if (!languageService) {
							languageService = createProjectLanguageService(server, project);
							tsconfigProjects.set(URI.file(project.configFileName), languageService);
						}
						return languageService;
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
				async getComponentDirectives(fileName) {
					try {
						return await (await connectTypeScriptApi()).getComponentDirectives(fileName);
					}
					catch {}
				},
				async getComponentMeta(fileName, tag) {
					try {
						const virtualCode = await getVueVirtualCode(fileName);
						if (virtualCode) {
							return await (await connectTypeScriptApi()).getComponentMeta(fileName, virtualCode, tag);
						}
					}
					catch {}
				},
				async getComponentNames(fileName) {
					try {
						const virtualCode = await getVueVirtualCode(fileName);
						if (virtualCode) {
							return await (await connectTypeScriptApi()).getComponentNames(fileName, virtualCode);
						}
					}
					catch {}
				},
				getComponentProps(...args) {
					return sendTsServerRequest('_vue:getComponentProps', args);
				},
				getComponentSlots(...args) {
					return sendTsServerRequest('_vue:getComponentSlots', args);
				},
				async getElementAttrs(fileName, tag) {
					try {
						return await (await connectTypeScriptApi()).getElementAttrs(fileName, tag);
					}
					catch {}
				},
				async getElementNames(fileName) {
					try {
						return await (await connectTypeScriptApi()).getElementNames(fileName);
					}
					catch {}
				},
				async getDefaultImportEdits(fileName, incomingFileName) {
					try {
						return await (await connectTypeScriptApi()).getDefaultImportEdits(fileName, incomingFileName);
					}
					catch {}
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
			}),
		);

		const packageJson = require('../package.json');
		result.serverInfo = {
			name: packageJson.name,
			version: packageJson.version,
		};

		return result;

		async function getVueVirtualCode(fileName: string) {
			const uri = URI.file(fileName);
			const languageService = await server.project.getLanguageService(uri);
			const virtualCode = languageService.context.language.scripts.get(uri)?.generated?.root;
			return virtualCode instanceof VueVirtualCode ? virtualCode : undefined;
		}

		async function sendTsServerRequest<T>(command: string, args: any): Promise<T | null> {
			return await new Promise<T | null>(resolve => {
				const requestId = ++tsserverRequestId;
				tsserverRequestHandlers.set(requestId, resolve);
				connection.sendNotification('tsserver/request', [requestId, command, args]);
			});
		}

		function createProjectLanguageService(server: LanguageServer, project: TypeScriptProject | undefined) {
			const configFileName = project?.configFileName;
			const asFileName = (uri: URI) => uri.fsPath.replace(/\\/g, '/');
			const contentMappers = configFileName
				? project!.contentMappers as ContentMapperEntry[] | undefined
				: inferredContentMappers;
			const vuePlugins = (contentMappers ?? [])
				.filter(entry => entry.package === '@vue/content-mapper')
				.map(entry =>
					routeByExtensions(
						createVueLanguagePlugin(
							ts,
							resolveVueCompilerOptions(ts, ts.sys, configFileName, entry.options),
							asFileName,
						),
						entry.extensions,
					)
				);
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

	connection.onInitialized(() => {
		server.initialized();
		void server.fileWatcher.watchFiles(['**/*.json']);
	});

	connection.onShutdown(server.shutdown);
}
