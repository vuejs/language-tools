import { fsPathToUri, normalizeFileName, uriToFsPath } from '@volar/shared';
import { createLanguageService, LanguageService, LanguageServiceHost } from '@volar/vscode-vue-languageservice';
import type * as ts from 'typescript';
import * as upath from 'upath';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Connection, Disposable, TextDocuments, WorkDoneProgressServerReporter } from 'vscode-languageserver/node';

export type ServiceHandler = ReturnType<typeof createServiceHandler>;

export function createServiceHandler(
	tsConfig: string,
	ts: typeof import('typescript'),
	tsLocalized: ts.MapLike<string> | undefined,
	connection: Connection,
	documents: TextDocuments<TextDocument>,
	isConnectionInited: () => boolean,
	fileUpdatedCb: (fileName: string) => any,
	_onProjectFilesUpdate: (() => void) | undefined,
) {

	let projectVersion = 0;
	let parsedCommandLine: ts.ParsedCommandLine;
	let workDoneProgress: WorkDoneProgressServerReporter | undefined;
	let vueLs: LanguageService | undefined;
	const fileWatchers = new Map<string, ts.FileWatcher>();
	const scriptVersions = new Map<string, string>();
	const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
	const extraFileWatchers = new Map<string, ts.FileWatcher>();
	const extraFileVersions = new Map<string, number>();
	const languageServiceHost = createLanguageServiceHost();
	const disposables: Disposable[] = [];

	update();
	prepareNextProgress();

	return {
		update,
		onDocumentUpdated,
		isRelatedFile,
		getLanguageService,
		getLanguageServiceDontCreate: () => vueLs,
		getParsedCommandLine: () => parsedCommandLine,
		dispose,
		prepareNextProgress,
	};

	function getLanguageService() {
		if (!vueLs) {
			vueLs = createLanguageService(languageServiceHost, { typescript: ts }, async p => {
				if (p === 0) {
					workDoneProgress?.begin('Initializing Vue language features');
				}
				if (p < 1) {
					workDoneProgress?.report(p * 100);
				}
				else {
					prepareNextProgress();
				}
			});
		}
		return vueLs;
	}
	async function prepareNextProgress() {
		workDoneProgress?.done();
		if (isConnectionInited()) {
			workDoneProgress = await connection.window.createWorkDoneProgress();
		}
	}
	function update() {

		parsedCommandLine = createParsedCommandLine(ts, tsConfig);

		const fileNames = new Set(parsedCommandLine.fileNames);
		let changed = false;

		for (const [fileName, fileWatcher] of extraFileWatchers) {
			fileWatcher.close();
		}
		extraFileWatchers.clear();
		extraFileVersions.clear();

		for (const fileName of fileWatchers.keys()) {
			if (!fileNames.has(fileName)) {
				fileWatchers.get(fileName)!.close();
				fileWatchers.delete(fileName);
				changed = true;
			}
		}
		for (const fileName of fileNames) {
			if (!fileWatchers.has(fileName)) {
				const fileWatcher = ts.sys.watchFile!(fileName, onDriveFileUpdated);
				fileWatchers.set(fileName, fileWatcher);
				changed = true;
			}
		}
		if (changed) {
			onProjectFilesUpdate();
		}
	}
	function onDocumentUpdated(document: TextDocument) {
		const fileName = uriToFsPath(document.uri);
		if (isRelatedFile(fileName)) {
			const newVersion = ts.sys.createHash!(document.getText());
			scriptVersions.set(fileName, newVersion);
			onProjectFilesUpdate();
		}
	}
	function isRelatedFile(fileName: string) {
		const isProjectFile = new Set(parsedCommandLine.fileNames).has(fileName);
		const isReferenceFile = scriptSnapshots.has(fileName);
		return isProjectFile || isReferenceFile;
	}
	function onDriveFileUpdated(fileName: string, eventKind: ts.FileWatcherEventKind) {

		if (eventKind !== ts.FileWatcherEventKind.Changed) {
			return;
		}

		fileName = normalizeFileName(fileName);
		const uri = fsPathToUri(fileName);

		if (documents.get(uri)) {
			// this file handle by vscode event
			return;
		}

		const oldVersion = scriptVersions.get(fileName);
		const oldVersionNum = Number(oldVersion);
		if (Number.isNaN(oldVersionNum)) {
			scriptVersions.set(fileName, '0');
		}
		else {
			scriptVersions.set(fileName, (oldVersionNum + 1).toString());
		}
		onProjectFilesUpdate();

		fileUpdatedCb(fileName);
	}
	async function onProjectFilesUpdate() {
		projectVersion++;
		if (_onProjectFilesUpdate) {
			_onProjectFilesUpdate();
		}
	}
	function createLanguageServiceHost() {

		const host: LanguageServiceHost = {
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
			getProjectVersion: () => projectVersion.toString(),
			getScriptFileNames: () => [
				...parsedCommandLine.fileNames,
				...[...extraFileVersions.keys()].filter(fileName => fileName.endsWith('.vue')), // create virtual files from extra vue scripts
			],
			getCurrentDirectory: () => upath.dirname(tsConfig),
			getCompilationSettings: () => parsedCommandLine.options,
			getScriptVersion,
			getScriptSnapshot,
		};

		if (tsLocalized) {
			host.getLocalizedDiagnosticMessages = () => tsLocalized;
		}

		return host;

		function fileExists(fileName: string) {
			fileName = normalizeFileName(ts.sys.realpath?.(fileName) ?? fileName);
			const fileExists = !!ts.sys.fileExists?.(fileName);
			if (
				fileExists
				&& !fileWatchers.has(fileName)
				&& !extraFileWatchers.has(fileName)
			) {
				const fileWatcher = ts.sys.watchFile!(fileName, (_, eventKind) => {
					if (eventKind === ts.FileWatcherEventKind.Changed) {
						extraFileVersions.set(fileName, (extraFileVersions.get(fileName) ?? 0) + 1);
					}
					if (eventKind === ts.FileWatcherEventKind.Deleted) {
						fileWatcher?.close();
						extraFileVersions.delete(fileName);
						extraFileWatchers.delete(fileName);
						scriptSnapshots.delete(fileName);
					}
					onProjectFilesUpdate();
				});
				extraFileVersions.set(fileName, 0);
				extraFileWatchers.set(fileName, fileWatcher);
				if (fileName.endsWith('.vue')) {
					projectVersion++;
					vueLs?.update(false); // create virtual files
				}
			}
			return fileExists;
		}
		function getScriptVersion(fileName: string) {
			return scriptVersions.get(fileName)
				?? extraFileVersions.get(fileName)?.toString()
				?? '';
		}
		function getScriptSnapshot(fileName: string) {
			const version = getScriptVersion(fileName);
			const cache = scriptSnapshots.get(fileName);
			if (cache && cache[0] === version) {
				return cache[1];
			}
			const text = getScriptText(fileName);
			if (text !== undefined) {
				const snapshot = ts.ScriptSnapshot.fromString(text);
				scriptSnapshots.set(fileName, [version.toString(), snapshot]);
				return snapshot;
			}
		}
		function getScriptText(fileName: string) {
			const doc = documents.get(fsPathToUri(fileName));
			if (doc) {
				return doc.getText();
			}
			if (ts.sys.fileExists(fileName)) {
				return ts.sys.readFile(fileName, 'utf8');
			}
		}
	}
	function dispose() {
		for (const [_, fileWatcher] of fileWatchers) {
			fileWatcher.close();
		}
		for (const [_, fileWatcher] of extraFileWatchers) {
			fileWatcher.close();
		}
		if (vueLs) {
			vueLs.dispose();
		}
		for (const disposable of disposables) {
			disposable.dispose();
		}
	}
}

function createParsedCommandLine(ts: typeof import('typescript'), tsConfig: string) {
	const parseConfigHost: ts.ParseConfigHost = {
		...ts.sys,
		readDirectory: (path, extensions, exclude, include, depth) => {
			return ts.sys.readDirectory(path, [...extensions, '.vue'], exclude, include, depth);
		},
	};
	const realTsConfig = ts.sys.realpath!(tsConfig);
	const config = ts.readJsonConfigFile(realTsConfig, ts.sys.readFile);
	const content = ts.parseJsonSourceFileConfigFileContent(config, parseConfigHost, upath.dirname(realTsConfig), {}, upath.basename(realTsConfig));
	content.options.outDir = undefined; // TODO: patching ts server broke with outDir + rootDir + composite/incremental
	content.fileNames = content.fileNames.map(normalizeFileName);
	return content;
}
