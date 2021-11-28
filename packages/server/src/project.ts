import * as shared from '@volar/shared';
import * as vue from 'vscode-vue-languageservice';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import { getSchemaRequestService } from './schemaRequestService';
import type { createLsConfigs } from './configs';
import * as path from 'upath';

export type Project = ReturnType<typeof createProject>;
export const fileRenamings = new Set<Promise<void>>();
export const renameFileContentCache = new Map<string, string>();

export async function createProject(
	ts: vue.Modules['typescript'],
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
	let tsProjectVersion = 0;
	let vueProjectVersion = 0;
	let vueLs: Promise<vue.LanguageService> | undefined;
	let parsedCommandLine = createParsedCommandLine();
	const scripts = shared.createPathMap<{
		version: number,
		snapshot: ts.IScriptSnapshot | undefined,
		snapshotVersion: number | undefined,
	}>();
	const languageServiceHost = createLanguageServiceHost();
	const disposables: vscode.Disposable[] = [];

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
	async function getLanguageService() {
		if (!vueLs) {
			vueLs = (async () => {
				const workDoneProgress = await connection.window.createWorkDoneProgress();
				const vueLs = vue.createLanguageService({ typescript: ts }, languageServiceHost);
				vueLs.__internal__.onInitProgress(p => {
					if (p === 0) {
						workDoneProgress.begin(getMessageText());
					}
					if (p < 1) {
						workDoneProgress.report(p * 100);
					}
					else {
						workDoneProgress.done();
					}
				});
				lsConfigs?.registerCustomData(vueLs);
				return vueLs;
			})();
		}
		return vueLs;
	}
	function getMessageText() {
		let messageText = options.initializationMessage;
		if (!messageText) {
			let numOfFeatures = 0;
			if (options.languageFeatures) {
				for (let feature in options.languageFeatures) {
					if (!!options.languageFeatures[feature as keyof typeof options.languageFeatures]) {
						numOfFeatures++;
					}
				}
			}
			messageText = `Initializing Vue language features (${numOfFeatures} features)`;
		}
		return messageText;
	}
	async function onWorkspaceFilesChanged(changes: vscode.FileEvent[]) {

		await Promise.all([...fileRenamings]);

		for (const change of changes) {

			const script = scripts.uriGet(change.uri);

			if (script && change.type === vscode.FileChangeType.Changed) {
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

			updateProjectVersion(change.uri.endsWith('.vue'));
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

		updateProjectVersion(document.uri.endsWith('.vue'));
	}
	function updateProjectVersion(isVueFile: boolean) {
		if (isVueFile) {
			vueProjectVersion++;
		}
		else {
			tsProjectVersion++;
		}
	}
	function createLanguageServiceHost() {

		const host: vue.LanguageServiceHost = {
			// vue
			createTsLanguageService(host) {
				return shared.createTsLanguageService(ts, host);
			},
			getEmmetConfig: lsConfigs?.getEmmetConfiguration,
			schemaRequestService: options.languageFeatures?.schemaRequestService ? getSchemaRequestService(connection, options.languageFeatures.schemaRequestService) : undefined,
			getPreferences: lsConfigs?.getTsPreferences,
			getFormatOptions: lsConfigs?.getTsFormatOptions,
			getCssLanguageSettings: lsConfigs?.getCssLanguageSettings,
			getHtmlHoverSettings: lsConfigs?.getHtmlHoverSettings,
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
			getProjectVersion: () => tsProjectVersion.toString(),
			getVueProjectVersion: () => vueProjectVersion.toString(),
			getTypeRootsVersion: () => typeRootVersion,
			getScriptFileNames: () => parsedCommandLine.fileNames,
			getCompilationSettings: () => parsedCommandLine.options,
			getVueCompilationSettings: () => shared.resolveVueCompilerOptions(parsedCommandLine.raw?.vueCompilerOptions ?? {}, projectSys.getCurrentDirectory()),
			getScriptVersion,
			getScriptSnapshot,
		};

		if (tsLocalized) {
			host.getLocalizedDiagnosticMessages = () => tsLocalized;
		}

		return host;

		function getScriptVersion(fileName: string) {
			return scripts.fsPathGet(fileName)?.version.toString()
				?? '';
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
						snapshot: snapshot,
						snapshotVersion: -1,
					});
				}
				return snapshot;
			}
		}
	}
	async function dispose() {
		if (vueLs) {
			(await vueLs).dispose();
		}
		for (const disposable of disposables) {
			disposable.dispose();
		}
		scripts.clear();
		disposables.length = 0;
	}
	function createParsedCommandLine() {
		const parseConfigHost: ts.ParseConfigHost = {
			useCaseSensitiveFileNames: projectSys.useCaseSensitiveFileNames,
			readDirectory: (path, extensions, exclude, include, depth) => {
				return projectSys.readDirectory(path, [...extensions, '.vue'], exclude, include, depth);
			},
			fileExists: projectSys.fileExists,
			readFile: projectSys.readFile,
		};
		if (typeof tsConfig === 'string') {
			return shared.createParsedCommandLine(ts, parseConfigHost, tsConfig);
		}
		else {
			const content = ts.parseJsonConfigFileContent({}, parseConfigHost, rootPath, tsConfig, 'tsconfig.json');
			content.options.outDir = undefined; // TODO: patching ts server broke with outDir + rootDir + composite/incremental
			content.fileNames = content.fileNames.map(shared.normalizeFileName);
			return content;
		}
	}
}

export function getScriptText(
	documents: vscode.TextDocuments<TextDocument>,
	fileName: string,
	sys: vue.Modules['typescript']['sys'],
) {
	const uri = shared.fsPathToUri(fileName);
	const doc = shared.getDocumentSafely(documents, uri);
	if (doc) {
		return doc.getText();
	}
	if (sys.fileExists(fileName)) {
		return sys.readFile(fileName, 'utf8');
	}
	return renameFileContentCache.get(shared.fsPathToUri(fileName));
}
