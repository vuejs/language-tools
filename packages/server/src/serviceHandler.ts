import * as shared from '@volar/shared';
import * as vue from 'vscode-vue-languageservice';
import type * as ts from 'typescript';
import * as upath from 'upath';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type * as vscode from 'vscode-languageserver';
import { getEmmetConfiguration } from './configs';
import { getSchemaRequestService } from './schemaRequestService';
import * as tsConfigs from './tsConfigs';
import * as ShPlugin from 'typescript-vscode-sh-plugin';

export type ServiceHandler = ReturnType<typeof createServiceHandler>;

export function createServiceHandler(
	ts: vue.Modules['typescript'],
	options: shared.ServerInitializationOptions,
	tsConfig: string,
	tsLocalized: ts.MapLike<string> | undefined,
	documents: vscode.TextDocuments<TextDocument>,
	onFileUpdated: (changedFileName: string | undefined) => any,
	workDoneProgress: vscode.WorkDoneProgressServerReporter,
	connection: vscode.Connection,
) {

	let projectVersion = 0;
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

	update();

	return {
		update,
		onDocumentUpdated,
		getLanguageService,
		getLanguageServiceDontCreate: () => vueLs,
		getParsedCommandLine: () => parsedCommandLine,
		dispose,
	};

	function getLanguageService() {
		if (!vueLs) {
			let numOfFeatures = 0;
			if (options.features) {
				for (let feature in options.features) {
					if (!!options.features[feature as keyof typeof options.features]) {
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
	function update() {

		parsedCommandLine = createParsedCommandLine(ts, tsConfig);

		const fileNames = new shared.FsPathSet(parsedCommandLine.fileNames);
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
					version: documents.get(shared.fsPathToUri(fileName))?.version ?? 0,
					fileWatcher,
				});
				changed = true;
			}
		}
		if (changed) {
			onProjectFilesUpdate(undefined);
		}
	}
	function onDocumentUpdated(document: TextDocument) {
		const fileName = shared.uriToFsPath(document.uri);
		const snapshot = snapshots.get(fileName);
		if (snapshot) {
			const snapshotLength = snapshot.snapshot.getLength();
			const documentText = document.getText();
			if (
				snapshotLength === documentText.length
				&& snapshot.snapshot.getText(0, snapshotLength) === documentText
			) {
				return;
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
			onProjectFilesUpdate(fileName);
		}
	}
	function onDriveFileUpdated(fileName: string, eventKind: ts.FileWatcherEventKind) {

		if (eventKind !== ts.FileWatcherEventKind.Changed) {
			return;
		}

		fileName = shared.normalizeFileName(fileName);
		const uri = shared.fsPathToUri(fileName);

		if (documents.get(uri)) {
			// this file handle by vscode event
			return;
		}

		const script = scripts.get(fileName);
		if (script) {
			script.version++;
		}
		onProjectFilesUpdate(fileName);
	}
	async function onProjectFilesUpdate(changedFileName: string | undefined) {
		projectVersion++;
		onFileUpdated(changedFileName);
	}
	function createLanguageServiceHost() {

		const host: vue.LanguageServiceHost = {
			// vue
			createTsLanguageService(host) {
				return shared.createTsLanguageService(ts, ShPlugin, host);
			},
			getEmmetConfig: getEmmetConfiguration,
			schemaRequestService: options.features?.schemaRequestService ? getSchemaRequestService(connection, options.features.schemaRequestService) : undefined,
			getPreferences: (document) => tsConfigs.getPreferences(connection, document),
			getFormatOptions: (document, options) => tsConfigs.getFormatOptions(connection, document, options),
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
			fileName = shared.normalizeFileName(ts.sys.realpath?.(fileName) ?? fileName);
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
					onProjectFilesUpdate(fileName);
				});
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
			const doc = documents.get(shared.fsPathToUri(fileName));
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

function createParsedCommandLine(ts: typeof import('typescript/lib/tsserverlibrary'), tsConfig: string) {
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
	content.fileNames = content.fileNames.map(shared.normalizeFileName);
	return content;
}
