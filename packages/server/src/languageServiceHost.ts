import * as ts from 'typescript';
import * as upath from 'upath';
import { LanguageService, createLanguageService, LanguageServiceHost } from '@volar/vscode-vue-languageservice';
import { uriToFsPath, fsPathToUri } from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Connection } from 'vscode-languageserver';
import type { TextDocuments } from 'vscode-languageserver';

export function createLanguageServiceHost(connection: Connection, documents: TextDocuments<TextDocument>, rootPath: string, diag: boolean) {
	let tsConfigs = ts.sys.readDirectory(rootPath, ['tsconfig.json'], undefined, ['**/*']);
	tsConfigs = tsConfigs.filter(tsConfig => upath.basename(tsConfig) === 'tsconfig.json');

	const languageServices = new Map<string, {
		languageService: LanguageService,
		getParsedCommandLine: () => ts.ParsedCommandLine,
		dispose: () => void,
	}>();

	for (const tsConfig of tsConfigs) {
		add(tsConfig);
	}

	ts.sys.watchDirectory!(rootPath, fileName => {
		if (upath.basename(fileName) === 'tsconfig.json') {
			if (ts.sys.fileExists(fileName)) {
				add(fileName);
			}
			else {
				remove(fileName);
			}
		}
	}, true);

	return get;

	function get(uri: string) {
		const fileName = uriToFsPath(uri);
		const firstMatchTsConfigs: string[] = [];
		const secondMatchTsConfigs: string[] = [];

		for (const kvp of languageServices) {
			const tsConfig = upath.resolve(kvp[0]);
			const parsedCommandLine = kvp[1].getParsedCommandLine();
			const fileNames = new Set(parsedCommandLine.fileNames);
			if (fileNames.has(fileName)) {
				const tsConfigDir = upath.dirname(tsConfig);
				if (fileName.startsWith(tsConfigDir)) { // is file under tsconfig.json folder
					firstMatchTsConfigs.push(tsConfig);
				}
				else {
					secondMatchTsConfigs.push(tsConfig);
				}
			}
		}
		let tsConfig = firstMatchTsConfigs
			.sort((a, b) => b.split('/').length - a.split('/').length)
			.shift()
		if (!tsConfig) {
			tsConfig = secondMatchTsConfigs
				.sort((a, b) => b.split('/').length - a.split('/').length)
				.shift()
		}
		if (tsConfig) {
			return languageServices.get(tsConfig)?.languageService;
		}
	}
	function add(tsConfig: string) {
		let projectCurrentReq = 0;
		let projectVersion = 0;
		let disposed = false;
		let parsedCommandLineUpdateTrigger = false;
		let parsedCommandLine = createParsedCommandLine();
		const fileCurrentReqs = new Map<string, number>();
		const fileWatchers = new Map<string, ts.FileWatcher>();
		const scriptVersions = new Map<string, string>();
		const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
		const languageServiceHost = createLanguageServiceHost();
		const ls = createLanguageService(languageServiceHost);

		onParsedCommandLineUpdate();
		const tsConfigWatcher = ts.sys.watchFile!(tsConfig, (fileName, eventKind) => {
			if (eventKind === ts.FileWatcherEventKind.Changed) {
				parsedCommandLine = createParsedCommandLine();
				onParsedCommandLineUpdate();
			}
		});
		const directoryWatcher = ts.sys.watchDirectory!(upath.dirname(tsConfig), fileName => {
			parsedCommandLineUpdateTrigger = true;
			setTimeout(() => {
				if (parsedCommandLineUpdateTrigger && !disposed) {
					parsedCommandLineUpdateTrigger = false;
					parsedCommandLine = createParsedCommandLine();
					onParsedCommandLineUpdate();
				}
			}, 0);
		}, true);

		documents.onDidChangeContent(change => onDidChangeContent(change.document));
		documents.onDidClose(change => connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] }));

		languageServices.set(tsConfig, {
			languageService: ls,
			getParsedCommandLine: () => parsedCommandLine,
			dispose: dispose,
		});

		function createParsedCommandLine() {
			const parseConfigHost: ts.ParseConfigHost = {
				...ts.sys,
				readDirectory: (path, extensions, exclude, include, depth) => {
					return [
						...ts.sys.readDirectory(path, extensions, exclude, include, depth),
						...ts.sys.readDirectory(path, ['.vue'], exclude, include, depth),
					];
				},
			};

			const file = ts.findConfigFile(tsConfig, ts.sys.fileExists)!;
			const config = ts.readJsonConfigFile(file, ts.sys.readFile);
			const content = ts.parseJsonSourceFileConfigFileContent(config, parseConfigHost, upath.dirname(file));
			content.options.allowJs = true; // TODO: should not patch?
			return content;
		}
		async function onDidChangeContent(document: TextDocument) {
			const fileName = uriToFsPath(document.uri);
			if (new Set(parsedCommandLine.fileNames).has(fileName)) {
				const newVersion = ts.sys.createHash!(document.getText());
				scriptVersions.set(fileName, newVersion);
				await onProjectFilesUpdate([document]);
			}
		}
		async function fullValidation(changedDocs: TextDocument[]) {
			const req = ++projectCurrentReq;
			const docs = [...changedDocs];
			const openedDocs = documents.all().filter(doc => doc.languageId === 'vue');
			for (const document of openedDocs) {
				if (changedDocs.find(doc => doc.uri === document.uri)) continue;
				docs.push(document);
			}
			for (const doc of docs) {
				if (req !== projectCurrentReq) break;
				await sendDiagnostics(doc);
			}
		}
		async function sendDiagnostics(document: TextDocument) {
			const req = (fileCurrentReqs.get(document.uri) ?? 0) + 1;
			fileCurrentReqs.set(document.uri, req);
			const isCancel = () => fileCurrentReqs.get(document.uri) !== req;

			const diagnostics = await ls.doValidation(document, isCancel, diagnostics => {
				connection.sendDiagnostics({ uri: document.uri, diagnostics }); // dirty
			});
			if (diagnostics !== undefined) {
				connection.sendDiagnostics({ uri: document.uri, diagnostics }); // finish
			}
		}
		function onParsedCommandLineUpdate() {
			const fileNames = new Set(parsedCommandLine.fileNames);
			let filesChanged = false;

			for (const fileName of fileWatchers.keys()) {
				if (!fileNames.has(fileName)) {
					fileWatchers.get(fileName)!.close();
					fileWatchers.delete(fileName);
					filesChanged = true;
				}
			}
			for (const fileName of fileNames) {
				if (!fileWatchers.has(fileName)) {
					const fileWatcher = ts.sys.watchFile!(fileName, (fileName, eventKind) => {
						if (eventKind === ts.FileWatcherEventKind.Changed) {
							onFileContentChanged(fileName);
						}
					});
					fileWatchers.set(fileName, fileWatcher);
					filesChanged = true;
				}
			}
			if (filesChanged) {
				onProjectFilesUpdate([]);
			}

			function onFileContentChanged(fileName: string) {
				fileName = upath.resolve(fileName);
				const uri = fsPathToUri(fileName);
				if (!documents.get(uri)) {
					const oldVersion = scriptVersions.get(fileName);
					const oldVersionNum = Number(oldVersion);
					if (Number.isNaN(oldVersionNum)) {
						scriptVersions.set(fileName, '0');
					}
					else {
						scriptVersions.set(fileName, (oldVersionNum + 1).toString());
					}
					onProjectFilesUpdate([]);
				}
			}
		}
		async function onProjectFilesUpdate(changedDocs: TextDocument[]) {
			projectVersion++;
			if (diag) {
				await fullValidation(changedDocs);
			}
		}
		function createLanguageServiceHost() {

			const host: LanguageServiceHost = {
				getProjectVersion: () => projectVersion.toString(),
				getScriptFileNames,
				getScriptVersion,
				getScriptSnapshot,
				getCurrentDirectory: () => upath.dirname(tsConfig),
				getCompilationSettings: () => parsedCommandLine.options,
				getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
				fileExists: ts.sys.fileExists,
				readFile: ts.sys.readFile,
				readDirectory: ts.sys.readDirectory,
			};

			return host;

			function getScriptFileNames() {
				return parsedCommandLine.fileNames;
			}
			function getScriptVersion(fileName: string) {
				const version = scriptVersions.get(fileName);
				if (version !== undefined) {
					return version.toString();
				}
				return '';
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
			disposed = true;
			for (const [uri, fileWatcher] of fileWatchers) {
				fileWatcher.close();
			}
			directoryWatcher.close();
			tsConfigWatcher.close();
			ls.dispose();
		}
	}
	function remove(tsConfig: string) {
		languageServices.get(tsConfig)?.dispose();
		languageServices.delete(tsConfig);
	}
}
