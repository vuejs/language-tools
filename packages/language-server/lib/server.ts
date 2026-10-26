import type { LanguageServer, MessageActionItem } from '@volar/language-server';
import { createLanguageServiceEnvironment } from '@volar/language-server/lib/project/simpleProject';
import { createConnection, createServer } from '@volar/language-server/node';
import {
	createLanguage,
	getComponentIsBinding,
	type LanguagePlugin,
	type RawVueCompilerOptions,
	resolveVueCompilerOptions,
	type TypeScript as CoreTypeScript,
} from '@vue/language-core';
import { readFileIfExists } from '@vue/language-core/lib/options/readFileIfExists';
import {
	createLanguageService,
	createUriMap,
	createVueLanguagePlugin,
	createVueLanguageServicePlugins,
	type LanguageService,
	VueVirtualCode,
} from '@vue/language-service';
import type { TextEdit } from '@vue/language-service/lib/requests';
import { placeScriptImportEdits } from '@vue/language-service/lib/virtualCodeQueries';
import { camelize, capitalize } from '@vue/shared';
import * as path from 'node:path';
import { URI } from 'vscode-uri';
import { getElementAt, getTagNameOffset } from './checkerQueries';
import { createReactivityAnalyzer, getInterpolationRanges, type ReactivityAnalysisParams } from './reactivity';
import {
	connectTypeScriptProjectResolver,
	type ContentMapperEntry,
	getComponentModuleExtensions,
	type TypeScriptProject,
	type TypeScriptProjectResolver,
} from './typescriptProject';

const moduleSpecifierRE = /\bfrom\s*(['"])(.+?)\1/;

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

	let typescriptApi: Promise<TypeScriptProjectResolver> | undefined;
	// The content mappers the client registers for files outside any tsconfig.
	let inferredContentMappers: ContentMapperEntry[] | undefined;
	const watchedExtensions = new Set<string>();
	const watchedPluginFiles = new Set<string>();
	/** The files of the `plugins` of each project's language service, which it is created again for when they change. */
	const projectPluginFiles = new WeakMap<LanguageService, Set<string>>();
	let initialized = false;

	connection.listen();

	/** Config files rebuild the project services; files with these extensions may add, change or remove a component. */
	function watchExtensions(extensions: string[]) {
		const added = extensions.filter(extension => !watchedExtensions.has(extension));
		for (const extension of added) {
			watchedExtensions.add(extension);
		}
		// before initialization, `onInitialized` watches the whole set
		if (initialized && added.length) {
			void server.fileWatcher.watchFiles(added.map(extension => `**/*${extension}`));
		}
	}

	/** Plugin files may lie outside the workspace, so each one is watched by its own path. */
	function watchPluginFiles(fileNames: Iterable<string>) {
		const added = [...fileNames].filter(fileName => !watchedPluginFiles.has(fileName));
		for (const fileName of added) {
			watchedPluginFiles.add(fileName);
		}
		if (initialized && added.length) {
			void server.fileWatcher.watchFiles(added);
		}
	}

	/** A failed acquisition is reported once and not cached, so the next request asks the client again. */
	function connectTypeScriptApi() {
		if (!typescriptApi) {
			const connecting = connection.sendRequest<TypeScriptApiConnection>('vue/typescriptApiConnection').then(
				({ pipe, packageJsonPath }) => connectTypeScriptProjectResolver(pipe, packageJsonPath, inferredContentMappers),
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
		inferredContentMappers = params.initializationOptions?.contentMappers;
		watchExtensions(getComponentModuleExtensions(inferredContentMappers));

		// Any JSON file may be a config or one it extends. The rebuilt services ask again with `openFiles`, which
		// makes the TypeScript language server apply the change notifications the editor already sent it.
		server.fileWatcher.onDidChangeWatchedFiles(({ changes }) => {
			if (changes.some(change => change.uri.endsWith('.json'))) {
				for (const languageService of tsconfigProjects.values()) {
					languageService.dispose();
				}
				tsconfigProjects.clear();
				void typescriptApi?.then(resolver => resolver.invalidate(), () => {});
				return;
			}
			const changedFileNames = changes.map(change => URI.parse(change.uri).fsPath.replace(/\\/g, '/'));
			const usesChangedPlugin = (languageService: LanguageService) =>
				changedFileNames.some(fileName => projectPluginFiles.get(languageService)?.has(fileName));
			for (const [uri, languageService] of tsconfigProjects) {
				if (usesChangedPlugin(languageService)) {
					languageService.dispose();
					tsconfigProjects.delete(uri);
				}
			}
			if (simpleLanguageService && usesChangedPlugin(simpleLanguageService)) {
				simpleLanguageService.dispose();
				simpleLanguageService = undefined;
			}
			for (const change of changes) {
				withResolver(change.uri, (resolver, fileName) => resolver.fileChanged(fileName));
			}
		});

		// Opening a document can change its content in the TypeScript language server, too.
		server.documents.onDidChangeContent(({ document }) => {
			withResolver(document.uri, (resolver, fileName) => resolver.fileChanged(fileName));
		});

		server.documents.onDidClose(({ document }) => {
			withResolver(document.uri, (resolver, fileName) => {
				// closing reverts unsaved content to the file on disk
				resolver.fileChanged(fileName);
				resolver.closeFile(fileName);
			});
		});

		/** Calls `fn` with the connected resolver, if any, for a `file:` document. */
		function withResolver(documentUri: string, fn: (resolver: TypeScriptProjectResolver, fileName: string) => void) {
			const uri = URI.parse(documentUri);
			if (uri.scheme === 'file') {
				const fileName = uri.fsPath.replace(/\\/g, '/');
				void typescriptApi?.then(resolver => fn(resolver, fileName), () => {});
			}
		}

		let simpleLanguageService: LanguageService | undefined;

		const result = server.initialize(
			params,
			{
				setup() {},
				async getLanguageService(uri) {
					const project = uri.scheme === 'file'
						? await getTypeScriptProject(uri.fsPath.replace(/\\/g, '/'))
						: undefined;
					const { parser } = await connectTypeScriptApi();
					if (project?.configFileName) {
						let languageService = tsconfigProjects.get(URI.file(project.configFileName));
						if (!languageService) {
							languageService = createProjectLanguageService(server, parser, project);
							tsconfigProjects.set(URI.file(project.configFileName), languageService);
						}
						return languageService;
					}
					return simpleLanguageService ??= createProjectLanguageService(server, parser, undefined);
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
				async collectExtractProps(fileName, [start, end]) {
					try {
						const virtualCode = (await getVueScript(fileName))?.virtualCode;
						const template = virtualCode?.ir.template;
						if (template) {
							return await (await connectTypeScriptApi()).collectExtractProps(
								fileName,
								virtualCode,
								template.startTagEnd + start,
								template.startTagEnd + end,
							);
						}
					}
					catch {}
				},
				async getComponentDirectives(fileName) {
					try {
						const script = await getVueScript(fileName);
						if (script) {
							return await (await connectTypeScriptApi()).getComponentDirectives(fileName, script.virtualCode);
						}
					}
					catch {}
				},
				async getComponentMeta(fileName, position) {
					try {
						const offset = await getComponentTagNameOffset(fileName, position);
						if (offset !== undefined) {
							return await (await connectTypeScriptApi()).getComponentMeta(fileName, offset);
						}
					}
					catch {}
				},
				async getComponentNames(fileName) {
					try {
						const script = await getVueScript(fileName);
						if (script) {
							return await (await connectTypeScriptApi()).getComponentNames(fileName, script.virtualCode);
						}
					}
					catch {}
				},
				async getComponentProps(fileName, position) {
					try {
						const template = (await getVueScript(fileName))?.virtualCode.ir.template;
						const element = getElementAt(template, position);
						// ElementTypes.COMPONENT
						if (!template || element?.tagType !== 1) {
							return;
						}
						const is = getComponentIsBinding(element);
						const api = await connectTypeScriptApi();
						return is
							? await api.getComponentProps(
								fileName,
								template.startTagEnd + is.exp.loc.start.offset,
								is.exp.loc.end.offset - is.exp.loc.start.offset,
							)
							: await api.getComponentProps(fileName, getTagNameOffset(template, element));
					}
					catch {}
				},
				async getComponentSlots(fileName) {
					try {
						const script = await getVueScript(fileName);
						if (script) {
							return await (await connectTypeScriptApi()).getComponentSlots(fileName, script.virtualCode);
						}
					}
					catch {}
				},
				async getElementAttrs(fileName, position) {
					try {
						const virtualCode = (await getVueScript(fileName))?.virtualCode;
						const template = virtualCode?.ir.template;
						const element = getElementAt(template, position);
						if (virtualCode && template && element) {
							return await (await connectTypeScriptApi()).getElementAttrs(
								fileName,
								virtualCode,
								// ElementTypes.ELEMENT
								element.tagType === 0 ? getTagNameOffset(template, element) : undefined,
								element.tag,
							);
						}
					}
					catch {}
				},
				async getElementNames(fileName) {
					try {
						const script = await getVueScript(fileName);
						if (script) {
							return await (await connectTypeScriptApi()).getElementNames(fileName, script.virtualCode);
						}
					}
					catch {}
				},
				async getDefaultImportEdits(fileName, incomingFileName) {
					try {
						return await (await connectTypeScriptApi()).getDefaultImportEdits(fileName, incomingFileName);
					}
					catch {}
				},
				async getAutoImportComponents(fileName) {
					try {
						return await (await connectTypeScriptApi()).getAutoImportComponents(fileName);
					}
					catch {}
				},
				async getAutoImportValues(fileName) {
					try {
						return await (await connectTypeScriptApi()).getAutoImportValues(fileName);
					}
					catch {}
				},
				async getComponentImportEdits(fileName, component) {
					try {
						const script = await getVueScript(fileName);
						if (script) {
							return placeScriptImportEdits(
								script.virtualCode,
								await (await connectTypeScriptApi()).getComponentImportEdits(fileName, component),
							);
						}
					}
					catch {}
				},
				async getImportFixes(fileName, position, elementPosition) {
					try {
						const script = await getVueScript(fileName);
						if (!script) {
							return;
						}
						const api = await connectTypeScriptApi();
						let name: string | undefined;
						const { template } = script.virtualCode.ir;
						const element = elementPosition === undefined ? undefined : getElementAt(template, elementPosition);
						if (element) {
							if (!template || !await api.isUnresolvedTag(fileName, getTagNameOffset(template, element))) {
								return;
							}
							name = camelize(element.tag);
						}
						else {
							name = await api.getUnresolvedName(fileName, position);
						}
						if (!name) {
							return;
						}
						let candidates: { fileName: string; edits: readonly TextEdit[] | undefined }[];
						if (element) {
							const components = (await api.getAutoImportComponents(fileName) ?? [])
								.filter(component => component.name === name || component.name === capitalize(name));
							candidates = await Promise.all(components.map(async component => ({
								fileName: component.fileName,
								edits: await api.getComponentImportEdits(fileName, component),
							})));
						}
						else {
							candidates = await api.getNamedImportFixes(fileName, name) ?? [];
						}
						return candidates.flatMap(({ fileName: moduleFileName, edits }) => {
							const wrapped = placeScriptImportEdits(script.virtualCode, edits);
							if (!wrapped?.length) {
								return [];
							}
							const specifier = wrapped.map(edit => moduleSpecifierRE.exec(edit.newText)?.[2]).find(Boolean)
								?? path.posix.relative(path.posix.dirname(fileName), moduleFileName);
							return [{ title: `Add import from "${specifier}"`, edits: wrapped }];
						});
					}
					catch {}
				},
				async getComponentDefinition(fileName, position) {
					try {
						const offset = await getComponentTagNameOffset(fileName, position);
						if (offset !== undefined) {
							return await (await connectTypeScriptApi()).getComponentDefinition(fileName, offset);
						}
					}
					catch {}
				},
				async isRefAtPosition(fileName, position) {
					try {
						return await (await connectTypeScriptApi()).isRefAtOffset(fileName, position);
					}
					catch {}
				},
				async isRenamedByTypeScript(fileName, position) {
					try {
						return await (await connectTypeScriptApi()).isRenamedAtOffset(fileName, position);
					}
					catch {}
				},
			}),
		);

		const packageJson = require('../package.json');
		result.serverInfo = {
			name: packageJson.name,
			version: packageJson.version,
		};

		const reactivityAnalyzer = createReactivityAnalyzer(ts);
		connection.onRequest(
			'vue/reactivityAnalysis',
			async ({ textDocument, offset, content }: ReactivityAnalysisParams) => {
				const fileName = URI.parse(textDocument.uri).fsPath.replace(/\\/g, '/');
				if (content !== undefined) {
					return reactivityAnalyzer.analyzeScript(fileName, content, offset);
				}
				const script = await getVueScript(fileName);
				if (script) {
					return reactivityAnalyzer.analyzeVueScript(script.virtualCode, fileName, offset);
				}
			},
		);
		connection.onRequest('vue/interpolationRanges', async ({ textDocument }: { textDocument: { uri: string } }) => {
			const script = await getVueScript(URI.parse(textDocument.uri).fsPath.replace(/\\/g, '/'));
			return script && getInterpolationRanges(script.virtualCode);
		});

		return result;

		async function getVueScript(fileName: string) {
			const uri = URI.file(fileName);
			const { language } = (await server.project.getLanguageService(uri)).context;
			const sourceScript = language.scripts.get(uri);
			const virtualCode = sourceScript?.generated?.root;
			if (sourceScript && virtualCode instanceof VueVirtualCode) {
				return { language, sourceScript, virtualCode };
			}
		}

		/** The source offset of the tag name of the component element that the template offset `position` lies in (or after the start of). */
		async function getComponentTagNameOffset(fileName: string, position: number) {
			const template = (await getVueScript(fileName))?.virtualCode.ir.template;
			const element = getElementAt(template, position);
			// ElementTypes.COMPONENT
			if (template && element?.tagType === 1) {
				return getTagNameOffset(template, element);
			}
		}

		function createProjectLanguageService(
			server: LanguageServer,
			parser: CoreTypeScript,
			project: TypeScriptProject | undefined,
		) {
			const configFileName = project?.configFileName;
			const asFileName = (uri: URI) => uri.fsPath.replace(/\\/g, '/');
			const contentMappers = configFileName ? project!.contentMappers : inferredContentMappers;
			const rootDir = (configFileName ? path.dirname(configFileName) : process.cwd()).replace(/\\/g, '/');
			watchExtensions(getComponentModuleExtensions(contentMappers));
			const pluginFiles: string[] = [];
			// Whichever Content Mapper an entry names, its files that the client syncs to this server, which it
			// selects by Vue language ids, are Vue files.
			const vuePlugins = (contentMappers ?? []).map(entry =>
				routeByExtensions(
					createVueLanguagePlugin(
						parser,
						resolveVueCompilerOptions(
							readFileIfExists,
							rootDir,
							entry.options as RawVueCompilerOptions,
							pluginFiles,
						),
						asFileName,
					),
					entry.extensions,
				)
			);
			const normalizedPluginFiles = new Set(pluginFiles.map(fileName => fileName.replace(/\\/g, '/')));
			watchPluginFiles(normalizedPluginFiles);
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
			const languageService = createLanguageService(
				language,
				server.languageServicePlugins,
				createLanguageServiceEnvironment(server, [...server.workspaceFolders.all]),
				{},
			);
			projectPluginFiles.set(languageService, normalizedPluginFiles);
			return languageService;

			/** Like the TypeScript host, hands the Vue plugin only the files matching `extensions`. */
			function routeByExtensions(plugin: LanguagePlugin<URI>, extensions: string[]): LanguagePlugin<URI> {
				const isContentMapperFile = (uri: URI) => {
					// Volar formats a document through a copy of it at `<uri>.tmp`, with the plugin of the document.
					const fileName = asFileName(uri).replace(/\.tmp$/, '');
					return extensions.some(extension => fileName.endsWith(extension));
				};
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
		initialized = true;
		void server.fileWatcher.watchFiles([
			'**/*.json',
			...[...watchedExtensions].map(extension => `**/*${extension}`),
			...watchedPluginFiles,
		]);
	});

	connection.onShutdown(server.shutdown);
}
