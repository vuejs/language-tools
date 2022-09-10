import * as shared from '@volar/shared';
import * as embeddedLS from '@volar/embedded-language-service';
import * as embedded from '@volar/embedded-language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { loadCustomPlugins } from './config';
import { GetDocumentContentRequest } from '../requests';
import { FileSystem, FileSystemHost, LanguageConfigs, RuntimeEnvironment, ServerInitializationOptions } from '../types';
import { createSnapshots } from './snapshots';
import { ConfigurationHost } from '@volar/vue-language-service';
import * as upath from 'upath';
import * as html from 'vscode-html-languageservice';

export interface Project extends ReturnType<typeof createProject> { }

export async function createProject(
	runtimeEnv: RuntimeEnvironment,
	languageConfigs: LanguageConfigs,
	fsHost: FileSystemHost,
	sys: FileSystem,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	options: ServerInitializationOptions,
	rootUri: URI,
	rootPath: string,
	tsConfig: string | ts.CompilerOptions,
	tsLocalized: ts.MapLike<string> | undefined,
	documents: ReturnType<typeof createSnapshots>,
	connection: vscode.Connection,
	configHost: ConfigurationHost | undefined,
) {

	let typeRootVersion = 0;
	let projectVersion = 0;
	let vueLs: embeddedLS.LanguageService | undefined;
	let parsedCommandLine = createParsedCommandLine(ts, sys, rootPath, tsConfig, languageConfigs);

	const scripts = shared.createUriMap<{
		version: number,
		fileName: string,
		snapshot: ts.IScriptSnapshot | undefined,
		snapshotVersion: number | undefined,
	}>();
	const languageServiceHost = createLanguageServiceHost();

	const disposeWatchEvent = fsHost.onDidChangeWatchedFiles(params => {
		onWorkspaceFilesChanged(params.changes);
	});
	const disposeDocChange = documents.onDidChangeContent(params => {
		projectVersion++;
	});

	return {
		getLanguageService,
		getLanguageServiceDontCreate: () => vueLs,
		getParsedCommandLine: () => parsedCommandLine,
		dispose,
	};

	function getLanguageService() {
		if (!vueLs) {
			vueLs = languageConfigs.createLanguageService(
				ts,
				parsedCommandLine,
				languageServiceHost,
				{
					rootUri,
					configurationHost: configHost,
					fileSystemProvider: runtimeEnv.fileSystemProvide,
					documentContext: getHTMLDocumentContext(ts, languageServiceHost),
					schemaRequestService: uri => {
						const protocol = uri.substring(0, uri.indexOf(':'));

						const builtInHandler = runtimeEnv.schemaRequestHandlers[protocol];
						if (builtInHandler) {
							return builtInHandler(uri);
						}

						if (typeof options === 'object' && options.languageFeatures?.schemaRequestService) {
							return connection.sendRequest(GetDocumentContentRequest.type, { uri }).then(responseText => {
								return responseText;
							}, error => {
								return Promise.reject(error.message);
							});
						}
						else {
							return Promise.reject('clientHandledGetDocumentContentRequest is false');
						}
					},
				},
				loadCustomPlugins(languageServiceHost.getCurrentDirectory()),
			);
		}
		return vueLs;
	}
	async function onWorkspaceFilesChanged(changes: vscode.FileEvent[]) {

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
				typeRootVersion++;
			}
		}

		const creates = changes.filter(change => change.type === vscode.FileChangeType.Created);
		const deletes = changes.filter(change => change.type === vscode.FileChangeType.Deleted);

		if (creates.length || deletes.length) {
			parsedCommandLine = createParsedCommandLine(ts, sys, rootPath, tsConfig, languageConfigs);
		}
	}
	function createLanguageServiceHost() {

		const host: embedded.LanguageServiceHost = {
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
			getCurrentDirectory: () => rootPath,
			getProjectReferences: () => parsedCommandLine.projectReferences, // if circular, broken with provide `getParsedCommandLine: () => parsedCommandLine`
			// custom
			getDefaultLibFileName: options => {
				try {
					return ts.getDefaultLibFilePath(options);
				} catch {
					return sys.resolvePath('node_modules/typescript/lib/' + ts.getDefaultLibFileName(options)); // web
				}
			},
			getProjectVersion: () => projectVersion.toString(),
			getTypeRootsVersion: () => typeRootVersion,
			getScriptFileNames: () => {
				const fileNames = new Set(parsedCommandLine.fileNames);
				for (const script of scripts.values()) {
					fileNames.add(script.fileName);
				}
				return [...fileNames];
			},
			getCompilationSettings: () => parsedCommandLine.options,
			getScriptVersion,
			getScriptSnapshot,
			getTypeScriptModule: () => ts,
		};

		if (tsLocalized) {
			host.getLocalizedDiagnosticMessages = () => tsLocalized;
		}

		return host;

		function getScriptVersion(fileName: string) {

			const doc = documents.data.pathGet(rootUri, fileName);
			if (doc) {
				return doc.version.toString();
			}

			return scripts.pathGet(rootUri, fileName)?.version.toString() ?? '';
		}
		function getScriptSnapshot(fileName: string) {

			const doc = documents.data.pathGet(rootUri, fileName);
			if (doc) {
				return doc.getSnapshot();
			}

			const script = scripts.pathGet(rootUri, fileName);
			if (script && script.snapshotVersion === script.version) {
				return script.snapshot;
			}

			if (sys.fileExists(fileName)) {
				const text = sys.readFile(fileName, 'utf8');
				if (text !== undefined) {
					const snapshot = ts.ScriptSnapshot.fromString(text);
					if (script) {
						script.snapshot = snapshot;
						script.snapshotVersion = script.version;
					}
					else {
						scripts.pathSet(rootUri, fileName, {
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
		vueLs?.dispose();
		scripts.clear();
		disposeWatchEvent();
		disposeDocChange();
	}
}

function createParsedCommandLine(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	sys: FileSystem,
	rootPath: string,
	tsConfig: string | ts.CompilerOptions,
	languageConfigs: LanguageConfigs,
): ts.ParsedCommandLine {
	try {
		const parseConfigHost: ts.ParseConfigHost = {
			useCaseSensitiveFileNames: sys.useCaseSensitiveFileNames,
			readDirectory: (path, extensions, exclude, include, depth) => {
				const exts = [...extensions, ...languageConfigs.definitelyExts];
				for (const passiveExt of languageConfigs.indeterminateExts) {
					if (include.some(i => i.endsWith(passiveExt))) {
						exts.push(passiveExt);
					}
				}
				return sys.readDirectory(path, exts, exclude, include, depth);
			},
			fileExists: sys.fileExists,
			readFile: sys.readFile,
		};
		if (typeof tsConfig === 'string') {
			return ts.parseJsonConfigFileContent(ts, parseConfigHost, tsConfig);
		}
		else {
			const content = ts.parseJsonConfigFileContent({}, parseConfigHost, rootPath, tsConfig, 'jsconfig.json');
			content.options.outDir = undefined; // TODO: patching ts server broke with outDir + rootDir + composite/incremental
			content.fileNames = content.fileNames.map(shared.normalizeFileName);
			return content;
		}
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
			const failedLookupLocations: string[] = (resolveResult as any).failedLookupLocations;
			const dirs = new Set<string>();

			for (const failed of failedLookupLocations) {
				let path = failed;
				const fileName = upath.basename(path);
				if (fileName === 'index.d.ts' || fileName === '*.d.ts') {
					dirs.add(upath.dirname(path));
				}
				if (path.endsWith('.d.ts')) {
					path = path.substring(0, path.length - '.d.ts'.length);
				}
				else {
					continue;
				}
				if (host.fileExists(path)) {
					return isUri ? shared.getUriByPath(URI.parse(base), path) : path;
				}
			}
			for (const dir of dirs) {
				if (host.directoryExists?.(dir) ?? true) {
					return isUri ? shared.getUriByPath(URI.parse(base), dir) : dir;
				}
			}

			return undefined;
		},
	};
	return documentContext;
}
