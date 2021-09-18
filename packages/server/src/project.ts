import * as shared from '@volar/shared';
import * as vue from 'vscode-vue-languageservice';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type * as vscode from 'vscode-languageserver';
import { getSchemaRequestService } from './schemaRequestService';
import type { createLsConfigs } from './configs';

export type Project = ReturnType<typeof createProject>;
export const fileRenamings = new Set<Promise<void>>();
export const renameFileContentCache = new Map<string, string>();

export function createProject(
	ts: vue.Modules['typescript'],
	options: shared.ServerInitializationOptions,
	rootPath: string,
	tsConfig: string | ts.CompilerOptions,
	tsLocalized: ts.MapLike<string> | undefined,
	documents: vscode.TextDocuments<TextDocument>,
	onUpdated: (changedFileName: string | undefined) => any,
	workDoneProgress: vscode.WorkDoneProgressServerReporter,
	connection: vscode.Connection,
	lsConfigs: ReturnType<typeof createLsConfigs>,
) {

	let tsProjectVersion = 0;
	let vueProjectVersion = 0;
	let parsedCommandLine: ts.ParsedCommandLine;
	let vueLs: vue.LanguageService | undefined;
	const snapshots = new shared.FsPathMap<{
		version: string,
		snapshot: ts.IScriptSnapshot,
	}>();
	const scripts = new shared.FsPathMap<{
		version: number,
		fileName: string,
		fileWatcher: ts.FileWatcher,
	}>();
	const extraScripts = new shared.FsPathMap<{
		version: number,
		fileName: string,
		fileWatcher: ts.FileWatcher,
	}>();
	const languageServiceHost = createLanguageServiceHost();
	const disposables: vscode.Disposable[] = [];

	init();

	return {
		onWorkspaceFilesChanged,
		onDocumentUpdated,
		getLanguageService,
		getLanguageServiceDontCreate: () => vueLs,
		getParsedCommandLine: () => parsedCommandLine,
		dispose,
	};

	function getLanguageService() {
		if (!vueLs) {
			let numOfFeatures = 0;
			if (options.languageFeatures) {
				for (let feature in options.languageFeatures) {
					if (!!options.languageFeatures[feature as keyof typeof options.languageFeatures]) {
						numOfFeatures++;
					}
				}
			}
			vueLs = vue.createLanguageService({ typescript: ts }, languageServiceHost);
			vueLs.__internal__.onInitProgress(p => {
				if (p === 0) {
					workDoneProgress.begin(`Initializing Vue language features (${numOfFeatures} features)`);
				}
				if (p < 1) {
					workDoneProgress.report(p * 100);
				}
				else {
					workDoneProgress.done();
				}
			});
		}
		return vueLs;
	}
	function onWorkspaceFilesChanged(changes: string[]) {

		const newFiles: string[] = [];

		for (const change of changes) {

			const fileName = shared.normalizeFileName(change);

			if (!scripts.has(fileName) && !extraScripts.has(fileName) && shared.isFileInDir(fileName, rootPath)) {
				newFiles.push(fileName);
			}
		}

		if (newFiles.length) {
			parsedCommandLine = createParsedCommandLine();
		}

		for (const fileName of newFiles) {
			if (parsedCommandLine.fileNames.includes(fileName)) {
				const fileWatcher = ts.sys.watchFile!(fileName, onDriveFileUpdated);
				scripts.set(fileName, {
					fileName,
					version: documents.get(shared.fsPathToUri(fileName))?.version ?? 0,
					fileWatcher,
				});
				onProjectUpdated(fileName);
			}
		}
	}
	async function init() {

		await Promise.all([...fileRenamings]);

		parsedCommandLine = createParsedCommandLine();

		const fileNames = new shared.FsPathSet(parsedCommandLine.fileNames);
		let changed = false;

		for (const [_, { fileWatcher }] of extraScripts) {
			fileWatcher?.close();
		}
		extraScripts.clear();

		const removeKeys: string[] = [];
		for (const [key, { fileName, fileWatcher }] of scripts) {
			if (!fileNames.has(fileName)) {
				fileWatcher?.close();
				removeKeys.push(key);
				changed = true;
			}
		}
		for (const removeKey of removeKeys) {
			scripts.delete(removeKey);
		}
		for (const fileName of parsedCommandLine.fileNames) {
			if (!scripts.has(fileName)) {
				const fileWatcher = ts.sys.watchFile!(fileName, onDriveFileUpdated);
				scripts.set(fileName, {
					fileName,
					version: documents.get(shared.fsPathToUri(fileName))?.version ?? 0,
					fileWatcher,
				});
				changed = true;
			}
		}
		if (changed) {
			onUpdated(undefined);
		}
	}
	async function onDocumentUpdated(document: TextDocument) {

		await Promise.all([...fileRenamings]);

		const fileName = shared.uriToFsPath(document.uri);
		const snapshot = snapshots.get(fileName);
		if (snapshot) {
			const snapshotLength = snapshot.snapshot.getLength();
			const documentText = document.getText();
			if (
				snapshotLength === documentText.length
				&& snapshot.snapshot.getText(0, snapshotLength) === documentText
			) {
				return false;
			}
		}
		const script = scripts.get(fileName);
		const extraScript = extraScripts.get(fileName);
		if (script) {
			script.version = document.version;
		}
		if (extraScript) {
			extraScript.version = document.version;
		}
		if (!!script || !!extraScript) {
			onProjectUpdated(fileName);
			return true;
		}
		return false;
	}
	async function onDriveFileUpdated(fileName: string, eventKind: ts.FileWatcherEventKind) {

		await Promise.all([...fileRenamings]);

		fileName = shared.normalizeFileName(fileName);

		if (eventKind === ts.FileWatcherEventKind.Changed) {

			const uri = shared.fsPathToUri(fileName);
			if (documents.get(uri)) {
				// this file handle by vscode event
				return;
			}

			const script = scripts.get(fileName);
			if (script) {
				script.version++;
				onProjectUpdated(fileName);
			}
		}
		else if (eventKind === ts.FileWatcherEventKind.Deleted) {

			const script = scripts.get(fileName);
			if (script) {
				script.fileWatcher?.close();
				scripts.delete(fileName);
				onProjectUpdated(fileName);
			}
		}
	}
	function onExtraFileUpdated(fileName: string, eventKind: ts.FileWatcherEventKind) {
		const extraFile = extraScripts.get(fileName);
		if (extraFile) {
			if (eventKind === ts.FileWatcherEventKind.Changed) {

				const uri = shared.fsPathToUri(fileName);
				if (documents.get(uri)) {
					// this file handle by vscode event
					return;
				}

				extraFile.version++;
			}
			if (eventKind === ts.FileWatcherEventKind.Deleted) {
				extraFile.fileWatcher?.close();
				extraScripts.delete(fileName);
				snapshots.delete(fileName);
			}
			onProjectUpdated(fileName);
		}
	}
	async function onProjectUpdated(changedFileName: string) {
		if (changedFileName.endsWith('.vue')) {
			vueProjectVersion++;
		}
		else {
			tsProjectVersion++;
		}
		onUpdated(changedFileName);
	}
	function createLanguageServiceHost() {

		const host: vue.LanguageServiceHost = {
			// vue
			createTsLanguageService(host) {
				return shared.createTsLanguageService(ts, host);
			},
			getEmmetConfig: lsConfigs.getEmmetConfiguration,
			schemaRequestService: options.languageFeatures?.schemaRequestService ? getSchemaRequestService(connection, options.languageFeatures.schemaRequestService) : undefined,
			getPreferences: lsConfigs.getTsPreferences,
			getFormatOptions: lsConfigs.getTsFormatOptions,
			getParsedCommandLine: () => parsedCommandLine,
			getCssLanguageSettings: lsConfigs.getCssLanguageSettings,
			// ts
			getNewLine: () => ts.sys.newLine,
			useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
			readFile: ts.sys.readFile,
			writeFile: ts.sys.writeFile,
			directoryExists: ts.sys.directoryExists,
			getDirectories: ts.sys.getDirectories,
			readDirectory: ts.sys.readDirectory,
			realpath: ts.sys.realpath,
			// custom
			fileExists,
			getDefaultLibFileName: options => ts.getDefaultLibFilePath(options), // TODO: vscode option for ts lib
			getProjectVersion: () => tsProjectVersion.toString(),
			getVueProjectVersion: () => vueProjectVersion.toString(),
			getScriptFileNames: () => parsedCommandLine.fileNames,
			getCurrentDirectory: () => rootPath,
			getCompilationSettings: () => parsedCommandLine.options,
			getScriptVersion,
			getScriptSnapshot,
		};

		if (tsLocalized) {
			host.getLocalizedDiagnosticMessages = () => tsLocalized;
		}

		return host;

		function fileExists(fileName: string) {
			fileName = shared.normalizeFileName(ts.sys.realpath?.(fileName) ?? fileName);
			const fileExists = !!ts.sys.fileExists?.(fileName);
			if (
				fileExists
				&& !scripts.has(fileName)
				&& !extraScripts.has(fileName)
			) {
				const fileWatcher = ts.sys.watchFile!(fileName, onExtraFileUpdated);
				extraScripts.set(fileName, {
					fileName: fileName,
					version: documents.get(shared.fsPathToUri(fileName))?.version ?? 0,
					fileWatcher: fileWatcher,
				});
			}
			return fileExists;
		}
		function getScriptVersion(fileName: string) {
			return scripts.get(fileName)?.version.toString()
				?? extraScripts.get(fileName)?.version.toString()
				?? '';
		}
		function getScriptSnapshot(fileName: string) {
			const version = getScriptVersion(fileName);
			const cache = snapshots.get(fileName);
			if (cache && cache.version === version) {
				return cache.snapshot;
			}
			const text = getScriptText(ts, documents, fileName);
			if (text !== undefined) {
				const snapshot = ts.ScriptSnapshot.fromString(text);
				snapshots.set(fileName, {
					version: version.toString(),
					snapshot,
				});
				return snapshot;
			}
		}
	}
	function dispose() {
		for (const [_, { fileWatcher }] of scripts) {
			fileWatcher?.close();
		}
		for (const [_, { fileWatcher }] of extraScripts) {
			fileWatcher?.close();
		}
		if (vueLs) {
			vueLs.dispose();
		}
		for (const disposable of disposables) {
			disposable.dispose();
		}
		scripts.clear();
		extraScripts.clear();
		disposables.length = 0;
	}
	function createParsedCommandLine() {
		const parseConfigHost: ts.ParseConfigHost = {
			...ts.sys,
			readDirectory: (path, extensions, exclude, include, depth) => {
				return ts.sys.readDirectory(path, [...extensions, '.vue'], exclude, include, depth);
			},
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
	ts: vue.Modules['typescript'],
	documents: vscode.TextDocuments<TextDocument>,
	fileName: string,
) {
	const doc = documents.get(shared.fsPathToUri(fileName));
	if (doc) {
		return doc.getText();
	}
	if (ts.sys.fileExists(fileName)) {
		return ts.sys.readFile(fileName, 'utf8');
	}
	return renameFileContentCache.get(shared.fsPathToUri(fileName));
}
