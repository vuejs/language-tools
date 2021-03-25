import { fsPathToUri, normalizeFileName, uriToFsPath } from '@volar/shared';
import { createLanguageService, LanguageService, LanguageServiceHost } from '@volar/vscode-vue-languageservice';
import { FsPathSet, FsPathMap } from '@volar/shared';
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
	const snapshots = new FsPathMap<{
		version: string,
		snapshot: ts.IScriptSnapshot,
	}>();
	const scripts = new FsPathMap<{
		version: number,
		fileName: string,
		fileWatcher: ts.FileWatcher,
	}>();
	const extraScripts = new FsPathMap<{
		version: number,
		fileName: string,
		fileWatcher: ts.FileWatcher,
	}>();
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

		const fileNames = new FsPathSet(parsedCommandLine.fileNames);
		let changed = false;

		for (const [_, { fileWatcher }] of extraScripts) {
			fileWatcher.close();
		}
		extraScripts.clear();

		const removeKeys: string[] = [];
		for (const [key, { fileName, fileWatcher }] of scripts) {
			if (!fileNames.has(fileName)) {
				fileWatcher.close();
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
					version: 0,
					fileWatcher,
				});
				changed = true;
			}
		}
		if (changed) {
			onProjectFilesUpdate();
		}
	}
	function onDocumentUpdated(document: TextDocument) {
		const fileName = uriToFsPath(document.uri);
		const script = scripts.get(fileName);
		const extraScript = extraScripts.get(fileName);
		if (script) {
			script.version++;
		}
		if (extraScript) {
			extraScript.version++;
		}
		if (script || extraScript) {
			onProjectFilesUpdate();
		}
	}
	function isRelatedFile(fileName: string) {
		const script = scripts.get(fileName);
		const extraScript = extraScripts.get(fileName);
		return !!script || !!extraScript;
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

		const script = scripts.get(fileName);
		if (script) {
			script.version++;
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
				...[...extraScripts.values()].map(file => file.fileName).filter(fileName => fileName.endsWith('.vue')), // create virtual files from extra vue scripts
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
				&& !scripts.has(fileName)
				&& !extraScripts.has(fileName)
			) {
				const fileWatcher = ts.sys.watchFile!(fileName, (_, eventKind) => {
					const extraFile = extraScripts.get(fileName);
					if (eventKind === ts.FileWatcherEventKind.Changed) {
						if (extraFile) {
							extraFile.version++;
						}
					}
					if (eventKind === ts.FileWatcherEventKind.Deleted) {
						fileWatcher?.close();
						extraScripts.delete(fileName);
						snapshots.delete(fileName);
					}
					onProjectFilesUpdate();
				});
				extraScripts.set(fileName, {
					fileName: fileName,
					version: 0,
					fileWatcher: fileWatcher,
				});
				if (fileName.endsWith('.vue')) {
					projectVersion++;
					vueLs?.update(false); // create virtual files
				}
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
			const text = getScriptText(fileName);
			if (text !== undefined) {
				const snapshot = ts.ScriptSnapshot.fromString(text);
				snapshots.set(fileName, {
					version: version.toString(),
					snapshot,
				});
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
		for (const [_, { fileWatcher }] of scripts) {
			fileWatcher.close();
		}
		for (const [_, { fileWatcher }] of extraScripts) {
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
