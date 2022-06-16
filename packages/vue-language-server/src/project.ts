import * as shared from '@volar/shared';
import * as vue from '@volar/vue-language-service';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import type { createLsConfigs } from './configHost';
import * as path from 'upath';
import { getDocumentSafely } from './utils';
import { LanguageConfigs, loadCustomPlugins, RuntimeEnvironment } from './common';
import { tsShared } from '@volar/vue-typescript';

export interface Project extends ReturnType<typeof createProject> { }
export const fileRenamings = new Set<Promise<void>>();
export const renameFileContentCache = new Map<string, string>();

export async function createProject(
	runtimeEnv: RuntimeEnvironment,
	languageConfigs: LanguageConfigs,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	options: shared.ServerInitializationOptions,
	rootPath: string,
	tsConfig: string | ts.CompilerOptions,
	tsLocalized: ts.MapLike<string> | undefined,
	documents: vscode.TextDocuments<TextDocument>,
	connection: vscode.Connection,
	lsConfigs: ReturnType<typeof createLsConfigs> | undefined,
) {

	await Promise.all([...fileRenamings]);

	const projectSys: typeof ts.sys = {
		...ts.sys,
		readFile: (path, encoding) => ts.sys.readFile(resolveAbsolutePath(path), encoding),
		writeFile: (path, content) => ts.sys.writeFile(resolveAbsolutePath(path), content),
		directoryExists: path => {
			if (path === '') {
				// fix https://github.com/johnsoncodehk/volar/issues/679
				return ts.sys.directoryExists(path);
			}
			return ts.sys.directoryExists(resolveAbsolutePath(path));
		},
		getDirectories: path => ts.sys.getDirectories(resolveAbsolutePath(path)),
		readDirectory: (path, extensions, exclude, include, depth) => ts.sys.readDirectory(resolveAbsolutePath(path), extensions, exclude, include, depth),
		realpath: ts.sys.realpath ? path => {
			const resolvedPath = resolveAbsolutePath(path);
			const realPath = ts.sys.realpath!(resolvedPath);
			if (realPath === resolvedPath) {
				// rollback if failed
				return path;
			}
			return realPath;
		} : undefined,
		fileExists: path => ts.sys.fileExists(resolveAbsolutePath(path)),
		getCurrentDirectory: () => rootPath,
	};

	let typeRootVersion = 0;
	let projectVersion = 0;
	let vueLs: vue.LanguageService | undefined;
	let parsedCommandLine = createParsedCommandLine();

	const scripts = shared.createPathMap<{
		version: number,
		fileName: string,
		snapshot: ts.IScriptSnapshot | undefined,
		snapshotVersion: number | undefined,
	}>();
	const languageServiceHost = createLanguageServiceHost();

	return {
		onWorkspaceFilesChanged,
		onDocumentUpdated,
		getLanguageService,
		getLanguageServiceDontCreate: () => vueLs,
		getParsedCommandLine: () => parsedCommandLine,
		dispose,
	};

	function resolveAbsolutePath(_path: string) {
		const relativePath = path.relative(ts.sys.getCurrentDirectory(), rootPath);
		if (relativePath === '') return _path;
		if (_path === '') return relativePath;
		return !path.isAbsolute(_path) ? relativePath + '/' + _path : _path;
	}
	function getLanguageService() {
		if (!vueLs) {
			vueLs = languageConfigs.createLanguageService(
				{ typescript: ts },
				languageServiceHost,
				runtimeEnv.fileSystemProvide,
				(uri) => {

					const protocol = uri.substring(0, uri.indexOf(':'));

					const builtInHandler = runtimeEnv.schemaRequestHandlers[protocol];
					if (builtInHandler) {
						return builtInHandler(uri);
					}

					if (typeof options === 'object' && options.languageFeatures?.schemaRequestService) {
						return connection.sendRequest(shared.GetDocumentContentRequest.type, { uri }).then(responseText => {
							return responseText;
						}, error => {
							return Promise.reject(error.message);
						});
					}
					else {
						return Promise.reject('clientHandledGetDocumentContentRequest is false');
					}
				},
				lsConfigs,
				loadCustomPlugins(languageServiceHost.getCurrentDirectory()),
				options.languageFeatures?.completion ? async (uri) => {

					if (options.languageFeatures?.completion?.getDocumentNameCasesRequest) {
						const res = await connection.sendRequest(shared.GetDocumentNameCasesRequest.type, { uri });
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
			);
		}
		return vueLs;
	}
	async function onWorkspaceFilesChanged(changes: vscode.FileEvent[]) {

		await Promise.all([...fileRenamings]);

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

			projectVersion++;
		}

		const creates = changes.filter(change => change.type === vscode.FileChangeType.Created);
		const deletes = changes.filter(change => change.type === vscode.FileChangeType.Deleted);

		if (creates.length || deletes.length) {
			parsedCommandLine = createParsedCommandLine();
			typeRootVersion++; // TODO: check changed in node_modules?
		}
	}
	async function onDocumentUpdated(document: TextDocument) {

		await Promise.all([...fileRenamings]);

		const script = scripts.uriGet(document.uri);
		if (script) {
			script.version = document.version;
		}

		projectVersion++;
	}
	function createLanguageServiceHost() {

		const host: vue.LanguageServiceHost = {
			// ts
			getNewLine: () => projectSys.newLine,
			useCaseSensitiveFileNames: () => projectSys.useCaseSensitiveFileNames,
			readFile: projectSys.readFile,
			writeFile: projectSys.writeFile,
			directoryExists: projectSys.directoryExists,
			getDirectories: projectSys.getDirectories,
			readDirectory: projectSys.readDirectory,
			realpath: projectSys.realpath,
			fileExists: projectSys.fileExists,
			getCurrentDirectory: projectSys.getCurrentDirectory,
			getProjectReferences: () => parsedCommandLine.projectReferences, // if circular, broken with provide `getParsedCommandLine: () => parsedCommandLine`
			// custom
			getDefaultLibFileName: options => ts.getDefaultLibFilePath(options), // TODO: vscode option for ts lib
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
		};

		if (tsLocalized) {
			host.getLocalizedDiagnosticMessages = () => tsLocalized;
		}

		return host;

		function getScriptVersion(fileName: string) {
			return scripts.fsPathGet(fileName)?.version.toString() ?? '';
		}
		function getScriptSnapshot(fileName: string) {
			const script = scripts.fsPathGet(fileName);
			if (script && script.snapshotVersion === script.version) {
				return script.snapshot;
			}
			const text = getScriptText(documents, fileName, projectSys);
			if (text !== undefined) {
				const snapshot = ts.ScriptSnapshot.fromString(text);
				if (script) {
					script.snapshot = snapshot;
					script.snapshotVersion = script.version;
				}
				else {
					scripts.fsPathSet(fileName, {
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
	function dispose() {
		vueLs?.dispose();
		scripts.clear();
	}
	function createParsedCommandLine(): ReturnType<typeof tsShared.createParsedCommandLine> {
		const parseConfigHost: ts.ParseConfigHost = {
			useCaseSensitiveFileNames: projectSys.useCaseSensitiveFileNames,
			readDirectory: (path, extensions, exclude, include, depth) => {
				const exts = [...extensions, ...languageConfigs.definitelyExts];
				for (const passiveExt of languageConfigs.indeterminateExts) {
					if (include.some(i => i.endsWith(passiveExt))) {
						exts.push(passiveExt);
					}
				}
				return projectSys.readDirectory(path, exts, exclude, include, depth);
			},
			fileExists: projectSys.fileExists,
			readFile: projectSys.readFile,
		};
		if (typeof tsConfig === 'string') {
			return tsShared.createParsedCommandLine(ts, parseConfigHost, tsConfig);
		}
		else {
			const content = ts.parseJsonConfigFileContent({}, parseConfigHost, rootPath, tsConfig, 'tsconfig.json');
			content.options.outDir = undefined; // TODO: patching ts server broke with outDir + rootDir + composite/incremental
			content.fileNames = content.fileNames.map(shared.normalizeFileName);
			return { ...content, vueOptions: {} };
		}
	}
}

export function getScriptText(
	documents: vscode.TextDocuments<TextDocument>,
	fileName: string,
	sys: typeof import('typescript/lib/tsserverlibrary')['sys'],
) {
	const uri = shared.fsPathToUri(fileName);
	const doc = getDocumentSafely(documents, uri);
	if (doc) {
		return doc.getText();
	}
	if (sys.fileExists(fileName)) {
		return sys.readFile(fileName, 'utf8');
	}
	return renameFileContentCache.get(shared.fsPathToUri(fileName));
}
