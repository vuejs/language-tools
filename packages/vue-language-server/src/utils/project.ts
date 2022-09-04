import * as shared from '@volar/shared';
import * as vue from '@volar/vue-language-service';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { loadCustomPlugins } from '../common';
import { GetDocumentContentRequest, GetDocumentNameCasesRequest } from '../requests';
import { FileSystem, FileSystemHost, LanguageConfigs, RuntimeEnvironment, ServerInitializationOptions } from '../types';
import type { createConfigurationHost } from './configurationHost';
import { createSnapshots } from './snapshots';

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
	configHost: ReturnType<typeof createConfigurationHost> | undefined,
) {

	let typeRootVersion = 0;
	let projectVersion = 0;
	let vueLs: vue.LanguageService | undefined;
	let parsedCommandLine: vue.ParsedCommandLine;

	try {
		// will be failed if web fs host first result not ready
		parsedCommandLine = createParsedCommandLine();
	} catch {
		parsedCommandLine = {
			errors: [],
			fileNames: [],
			options: {},
			vueOptions: {},
		};
	}

	const scripts = shared.createUriAndPathMap<{
		version: number,
		fileName: string,
		snapshot: ts.IScriptSnapshot | undefined,
		snapshotVersion: number | undefined,
	}>(rootUri);
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
				languageServiceHost,
				runtimeEnv.fileSystemProvide,
				(uri) => {

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
				configHost,
				loadCustomPlugins(languageServiceHost.getCurrentDirectory()),
				options.languageFeatures?.completion ? async (uri) => {

					if (options.languageFeatures?.completion?.getDocumentNameCasesRequest) {
						const res = await connection.sendRequest(GetDocumentNameCasesRequest.type, { uri });
						return {
							tag: res.tagNameCase,
							attr: res.attrNameCase,
						};
					}

					return {
						tag: options.languageFeatures!.completion!.defaultTagNameCase,
						attr: options.languageFeatures!.completion!.defaultAttrNameCase,
					};
				} : undefined,
				undefined,
				rootUri,
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
			parsedCommandLine = createParsedCommandLine();
		}
	}
	function createLanguageServiceHost() {

		const host: vue.LanguageServiceHost = {
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
			getVueCompilationSettings: () => parsedCommandLine.vueOptions,
			getScriptVersion,
			getScriptSnapshot,
			getTypeScriptModule: () => ts,
		};

		if (tsLocalized) {
			host.getLocalizedDiagnosticMessages = () => tsLocalized;
		}

		return host;

		function getScriptVersion(fileName: string) {

			fileName = sys.resolvePath(fileName);

			const doc = documents.data.uriGet(shared.getUriByPath(rootUri, fileName));
			if (doc) {
				return doc.version.toString();
			}

			return scripts.pathGet(fileName)?.version.toString() ?? '';
		}
		function getScriptSnapshot(fileName: string) {

			fileName = sys.resolvePath(fileName);

			const doc = documents.data.uriGet(shared.getUriByPath(rootUri, fileName));
			if (doc) {
				return doc.getSnapshot();
			}

			const script = scripts.pathGet(fileName);
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
		vueLs?.dispose();
		scripts.clear();
		disposeWatchEvent();
		disposeDocChange();
	}
	function createParsedCommandLine(): ReturnType<typeof vue.createParsedCommandLine> {
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
			return vue.createParsedCommandLine(ts, parseConfigHost, tsConfig);
		}
		else {
			const content = ts.parseJsonConfigFileContent({}, parseConfigHost, rootPath, tsConfig, 'jsconfig.json');
			content.options.outDir = undefined; // TODO: patching ts server broke with outDir + rootDir + composite/incremental
			content.fileNames = content.fileNames.map(shared.normalizeFileName);
			return { ...content, vueOptions: {} };
		}
	}
}
