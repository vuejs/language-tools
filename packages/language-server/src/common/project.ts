import * as embedded from '@volar/language-core';
import * as embeddedLS from '@volar/language-service';
import * as shared from '@volar/shared';
import * as path from 'typesafe-path';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { FileSystem, LanguageServerPlugin, ServerMode } from '../types';
import { createUriMap } from './utils/uriMap';
import { WorkspaceContext } from './workspace';
import { ServerConfig } from './utils/serverConfig';

export interface ProjectContext {
	workspace: WorkspaceContext;
	rootUri: URI;
	tsConfig: path.PosixPath | ts.CompilerOptions,
	documentRegistry: ts.DocumentRegistry,
	serverConfig: ServerConfig | undefined,
}

export type Project = ReturnType<typeof createProject>;

export async function createProject(context: ProjectContext) {

	const sys: FileSystem = context.workspace.workspaces.initOptions.serverMode === ServerMode.Syntactic
		? {
			newLine: '\n',
			useCaseSensitiveFileNames: false,
			fileExists: () => false,
			readFile: () => undefined,
			readDirectory: () => [],
			getCurrentDirectory: () => '',
			realpath: () => '',
			resolvePath: () => '',
		}
		: context.workspace.workspaces.fileSystemHost.getWorkspaceFileSystem(context.rootUri);

	let typeRootVersion = 0;
	let projectVersion = 0;
	let projectVersionUpdateTime = context.workspace.workspaces.cancelTokenHost.getMtime();
	let languageService: embeddedLS.LanguageService | undefined;
	let parsedCommandLine = createParsedCommandLine(context.workspace.workspaces.ts, sys, shared.getPathOfUri(context.rootUri.toString()), context.tsConfig, context.workspace.workspaces.plugins);

	const scripts = createUriMap<{
		version: number,
		fileName: string,
		snapshot: ts.IScriptSnapshot | undefined,
		snapshotVersion: number | undefined,
	}>();
	const languageServiceHost = createLanguageServiceHost();
	const disposeWatchEvent = context.workspace.workspaces.fileSystemHost.onDidChangeWatchedFiles(params => {
		onWorkspaceFilesChanged(params.changes);
	});
	const disposeDocChange = context.workspace.workspaces.documents.onDidChangeContent(() => {
		projectVersion++;
		projectVersionUpdateTime = context.workspace.workspaces.cancelTokenHost.getMtime();
	});

	return {
		tsConfig: context.tsConfig,
		scripts,
		languageServiceHost,
		getLanguageService,
		getLanguageServiceDontCreate: () => languageService,
		getParsedCommandLine: () => parsedCommandLine,
		tryAddFile: (fileName: string) => {
			if (!parsedCommandLine.fileNames.includes(fileName)) {
				parsedCommandLine.fileNames.push(fileName);
				projectVersion++;
				projectVersionUpdateTime = context.workspace.workspaces.cancelTokenHost.getMtime();
			}
		},
		dispose,
	};

	function getLanguageService() {
		if (!languageService) {

			const languageModules = context.workspace.workspaces.plugins.map(plugin => plugin.getLanguageModules?.(languageServiceHost) ?? []).flat();
			const languageContext = embedded.createLanguageContext(languageServiceHost, languageModules);
			const languageServiceContext = embeddedLS.createLanguageServiceContext({
				host: languageServiceHost,
				context: languageContext,
				getPlugins() {
					return [
						...context.serverConfig?.plugins ?? [],
						...context.workspace.workspaces.plugins.map(plugin => plugin.getServicePlugins?.(languageServiceHost, languageService!) ?? []).flat(),
					];
				},
				env: {
					rootUri: context.rootUri,
					configurationHost: context.workspace.workspaces.configurationHost,
					fileSystemProvider: context.workspace.workspaces.server.runtimeEnv.fileSystemProvide,
					documentContext: getHTMLDocumentContext(context.workspace.workspaces.ts, languageServiceHost),
					schemaRequestService: async uri => {
						const protocol = uri.substring(0, uri.indexOf(':'));
						const builtInHandler = context.workspace.workspaces.server.runtimeEnv.schemaRequestHandlers[protocol];
						if (builtInHandler) {
							return await builtInHandler(uri);
						}
						return '';
					},
				},
				documentRegistry: context.documentRegistry,
			});
			languageService = embeddedLS.createLanguageService(languageServiceContext);
		}
		return languageService;
	}
	async function onWorkspaceFilesChanged(changes: vscode.FileEvent[]) {

		const _projectVersion = projectVersion;

		for (const change of changes) {

			const script = scripts.uriGet(change.uri);

			if (script && (change.type === vscode.FileChangeType.Changed || change.type === vscode.FileChangeType.Created)) {
				if (script.version >= 0) {
					script.version = -1;
				}
				else {
					script.version--;
				}
			}
			else if (script && change.type === vscode.FileChangeType.Deleted) {
				scripts.uriDelete(change.uri);
			}

			if (script) {
				projectVersion++;
			}
		}

		const creates = changes.filter(change => change.type === vscode.FileChangeType.Created);
		const deletes = changes.filter(change => change.type === vscode.FileChangeType.Deleted);

		if (creates.length || deletes.length) {
			parsedCommandLine = createParsedCommandLine(context.workspace.workspaces.ts, sys, shared.getPathOfUri(context.rootUri.toString()), context.tsConfig, context.workspace.workspaces.plugins);
			projectVersion++;
			typeRootVersion++;
		}

		if (_projectVersion !== projectVersion) {
			projectVersionUpdateTime = context.workspace.workspaces.cancelTokenHost.getMtime();
		}
	}
	function createLanguageServiceHost() {

		const token: ts.CancellationToken = {
			isCancellationRequested() {
				return context.workspace.workspaces.cancelTokenHost.getMtime() !== projectVersionUpdateTime;
			},
			throwIfCancellationRequested() { },
		};
		let host: embedded.LanguageServiceHost = {
			// ts
			getNewLine: () => sys.newLine,
			useCaseSensitiveFileNames: () => sys.useCaseSensitiveFileNames,
			readFile: sys.readFile,
			writeFile: sys.writeFile,
			directoryExists: sys.directoryExists,
			getDirectories: sys.getDirectories,
			readDirectory: sys.readDirectory,
			realpath: sys.realpath,
			fileExists: sys.fileExists,
			getCurrentDirectory: () => shared.getPathOfUri(context.rootUri.toString()),
			getProjectReferences: () => parsedCommandLine.projectReferences, // if circular, broken with provide `getParsedCommandLine: () => parsedCommandLine`
			getCancellationToken: () => token,
			// custom
			getDefaultLibFileName: options => {
				try {
					return context.workspace.workspaces.ts.getDefaultLibFilePath(options);
				} catch {
					// web
					return context.workspace.workspaces.initOptions.typescript.tsdk + '/' + context.workspace.workspaces.ts.getDefaultLibFileName(options);
				}
			},
			getProjectVersion: () => projectVersion.toString(),
			getTypeRootsVersion: () => typeRootVersion,
			getScriptFileNames: () => parsedCommandLine.fileNames,
			getCompilationSettings: () => parsedCommandLine.options,
			getScriptVersion,
			getScriptSnapshot,
			getTypeScriptModule: () => context.workspace.workspaces.ts,
		};

		if (context.workspace.workspaces.initOptions.noProjectReferences) {
			host.getProjectReferences = undefined;
			host.getCompilationSettings = () => ({
				...parsedCommandLine.options,
				rootDir: undefined,
				composite: false,
			});
		}

		if (context.workspace.workspaces.tsLocalized) {
			host.getLocalizedDiagnosticMessages = () => context.workspace.workspaces.tsLocalized;
		}

		for (const plugin of context.workspace.workspaces.plugins) {
			if (plugin.resolveLanguageServiceHost) {
				host = plugin.resolveLanguageServiceHost(context.workspace.workspaces.ts, sys, context.tsConfig, host);
			}
		}

		return host;

		function getScriptVersion(fileName: string) {

			const doc = context.workspace.workspaces.documents.data.pathGet(fileName);
			if (doc) {
				return doc.version.toString();
			}

			return scripts.pathGet(fileName)?.version.toString() ?? '';
		}
		function getScriptSnapshot(fileName: string) {

			const doc = context.workspace.workspaces.documents.data.pathGet(fileName);
			if (doc) {
				return doc.getSnapshot();
			}

			const script = scripts.pathGet(fileName);
			if (script && script.snapshotVersion === script.version) {
				return script.snapshot;
			}

			if (sys.fileExists(fileName)) {
				if (context.workspace.workspaces.initOptions.maxFileSize) {
					const fileSize = sys.getFileSize?.(fileName);
					if (fileSize !== undefined && fileSize > context.workspace.workspaces.initOptions.maxFileSize) {
						console.warn(`IGNORING "${fileName}" because it is too large (${fileSize}bytes > ${context.workspace.workspaces.initOptions.maxFileSize}bytes)`);
						return context.workspace.workspaces.ts.ScriptSnapshot.fromString('');
					}
				}
				const text = sys.readFile(fileName, 'utf8');
				if (text !== undefined) {
					const snapshot = context.workspace.workspaces.ts.ScriptSnapshot.fromString(text);
					if (script) {
						script.snapshot = snapshot;
						script.snapshotVersion = script.version;
					}
					else {
						scripts.pathSet(fileName, {
							version: -1,
							fileName: fileName,
							snapshot: snapshot,
							snapshotVersion: -1,
						});
					}
					return snapshot;
				}
			}
		}
	}
	function dispose() {
		languageService?.dispose();
		scripts.clear();
		disposeWatchEvent();
		disposeDocChange();
	}
}

function createParsedCommandLine(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	sys: FileSystem,
	rootPath: path.PosixPath,
	tsConfig: path.PosixPath | ts.CompilerOptions,
	plugins: ReturnType<LanguageServerPlugin>[],
): ts.ParsedCommandLine {
	const extraFileExtensions = plugins.map(plugin => plugin.extraFileExtensions ?? []).flat();
	try {
		let content: ts.ParsedCommandLine;
		if (typeof tsConfig === 'string') {
			const config = ts.readJsonConfigFile(tsConfig, sys.readFile);
			content = ts.parseJsonSourceFileConfigFileContent(config, sys, path.dirname(tsConfig), {}, tsConfig, undefined, extraFileExtensions);
		}
		else {
			content = ts.parseJsonConfigFileContent({ files: [] }, sys, rootPath, tsConfig, path.join(rootPath, 'jsconfig.json' as path.PosixPath), undefined, extraFileExtensions);
		}
		// fix https://github.com/johnsoncodehk/volar/issues/1786
		// https://github.com/microsoft/TypeScript/issues/30457
		// patching ts server broke with outDir + rootDir + composite/incremental
		content.options.outDir = undefined;
		content.fileNames = content.fileNames.map(shared.normalizeFileName);
		return content;
	}
	catch {
		// will be failed if web fs host first result not ready
		return {
			errors: [],
			fileNames: [],
			options: {},
		};
	}
}

function getHTMLDocumentContext(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	host: ts.LanguageServiceHost,
) {
	const documentContext: html.DocumentContext = {
		resolveReference(ref: string, base: string) {

			const isUri = base.indexOf('://') >= 0;
			const resolveResult = ts.resolveModuleName(
				ref,
				isUri ? shared.getPathOfUri(base) : base,
				host.getCompilationSettings(),
				host,
			);
			const failedLookupLocations: path.PosixPath[] = (resolveResult as any).failedLookupLocations;
			const dirs = new Set<string>();

			for (let failed of failedLookupLocations) {
				const fileName = path.basename(failed);
				if (fileName === 'index.d.ts' || fileName === '*.d.ts') {
					dirs.add(path.dirname(failed));
				}
				if (failed.endsWith('.d.ts')) {
					failed = failed.substring(0, failed.length - '.d.ts'.length) as path.PosixPath;
				}
				else {
					continue;
				}
				if (host.fileExists(failed)) {
					return isUri ? shared.getUriByPath(failed) : failed;
				}
			}
			for (const dir of dirs) {
				if (host.directoryExists?.(dir) ?? true) {
					return isUri ? shared.getUriByPath(dir) : dir;
				}
			}

			return undefined;
		},
	};
	return documentContext;
}
