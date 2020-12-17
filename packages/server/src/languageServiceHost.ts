import * as ts from 'typescript';
import * as upath from 'upath';
import { LanguageService, createLanguageService, LanguageServiceHost } from '@volar/vscode-vue-languageservice';
import { uriToFsPath, fsPathToUri, sleep, notEmpty } from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Connection, Disposable } from 'vscode-languageserver/node';
import type { TextDocuments } from 'vscode-languageserver/node';

export function createLanguageServiceHost(
	connection: Connection,
	documents: TextDocuments<TextDocument>,
	rootPath: string,
	getDocVersionForDiag?: (uri: string) => Promise<number | undefined>,
	_onProjectFilesUpdate?: () => void,
) {
	const searchFiles = ['tsconfig.json', 'jsconfig.json'];
	let tsConfigs = ts.sys.readDirectory(rootPath, searchFiles, undefined, ['**/*']);
	tsConfigs = tsConfigs.filter(tsConfig => searchFiles.includes(upath.basename(tsConfig)));

	const languageServices = new Map<string, {
		languageService: LanguageService,
		getParsedCommandLine: () => ts.ParsedCommandLine,
		dispose: () => void,
	}>();

	for (const tsConfig of tsConfigs) {
		languageServices.set(tsConfig, createLs(tsConfig));
	}

	ts.sys.watchDirectory!(rootPath, tsConfig => {
		if (searchFiles.includes(upath.basename(tsConfig))) {
			if (ts.sys.fileExists(tsConfig)) {
				if (!languageServices.has(tsConfig)) {
					languageServices.set(tsConfig, createLs(tsConfig));
				}
			}
			else {
				if (languageServices.has(tsConfig)) {
					languageServices.get(tsConfig)?.dispose();
					languageServices.delete(tsConfig);
				}
			}
		}
	}, true);

	return {
		services: languageServices,
		best,
		all,
		restart,
	};

	function restart() {
		for (const [tsConfig, service] of languageServices) {
			for (const doc of documents.all()) {
				connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] })
			}
			service.dispose();
			const newLs = createLs(tsConfig);
			languageServices.set(tsConfig, newLs);
			newLs.onProjectFilesUpdate([]);
		}
	}
	function best(uri: string) {
		const matches = _all(uri);
		if (matches.first.length)
			return languageServices.get(matches.first[0])?.languageService;
		if (matches.second.length)
			return languageServices.get(matches.second[0])?.languageService;
	}
	function all(uri: string) {
		const matches = _all(uri);
		return [...matches.first, ...matches.second].map(tsConfig => languageServices.get(tsConfig)?.languageService).filter(notEmpty);
	}
	function _all(uri: string) {
		const fileName = uriToFsPath(uri);
		let firstMatchTsConfigs: string[] = [];
		let secondMatchTsConfigs: string[] = [];

		for (const kvp of languageServices) {
			const tsConfig = upath.resolve(kvp[0]);
			const parsedCommandLine = kvp[1].getParsedCommandLine();
			const fileNames = new Set(parsedCommandLine.fileNames);
			if (fileNames.has(fileName) || kvp[1].languageService.getTsService().getTextDocument(uri)) {
				const tsConfigDir = upath.dirname(tsConfig);
				if (fileName.startsWith(tsConfigDir)) { // is file under tsconfig.json folder
					firstMatchTsConfigs.push(tsConfig);
				}
				else {
					secondMatchTsConfigs.push(tsConfig);
				}
			}
		}
		firstMatchTsConfigs = firstMatchTsConfigs.sort((a, b) => b.split('/').length - a.split('/').length)
		secondMatchTsConfigs = secondMatchTsConfigs.sort((a, b) => b.split('/').length - a.split('/').length)

		return {
			first: firstMatchTsConfigs,
			second: secondMatchTsConfigs,
		};
	}
	function createLs(tsConfig: string) {
		let projectCurrentReq = 0;
		let projectVersion = 0;
		let disposed = false;
		let parsedCommandLineUpdateTrigger = false;
		let parsedCommandLine = createParsedCommandLine();
		let currentValidation: Promise<void> | undefined;
		const fileCurrentReqs = new Map<string, number>();
		const fileWatchers = new Map<string, ts.FileWatcher>();
		const scriptVersions = new Map<string, string>();
		const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
		const languageServiceHost = createLanguageServiceHost();
		const vueLanguageService = createLanguageService(languageServiceHost);
		const disposables: Disposable[] = [];

		onParsedCommandLineUpdate();
		const tsConfigWatcher = ts.sys.watchFile!(tsConfig, (fileName, eventKind) => {
			if (eventKind === ts.FileWatcherEventKind.Changed) {
				parsedCommandLine = createParsedCommandLine();
				onParsedCommandLineUpdate();
			}
		});
		const directoryWatcher = ts.sys.watchDirectory!(upath.dirname(tsConfig), async fileName => {
			parsedCommandLineUpdateTrigger = true;
			await sleep(0);
			if (parsedCommandLineUpdateTrigger && !disposed) {
				parsedCommandLineUpdateTrigger = false;
				parsedCommandLine = createParsedCommandLine();
				onParsedCommandLineUpdate();
			}
		}, true);

		disposables.push(documents.onDidChangeContent(change => onDidChangeContent(change.document)));
		disposables.push(documents.onDidClose(change => connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] })));

		return {
			languageService: vueLanguageService,
			getParsedCommandLine: () => parsedCommandLine,
			dispose: dispose,
			onProjectFilesUpdate,
		};

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

			const realTsConfig = ts.sys.realpath!(tsConfig);
			const config = ts.readJsonConfigFile(realTsConfig, ts.sys.readFile);
			const content = ts.parseJsonSourceFileConfigFileContent(config, parseConfigHost, upath.dirname(realTsConfig), {}, upath.basename(realTsConfig));
			return content;
		}
		async function onDidChangeContent(document: TextDocument) {
			if (disposed) return;
			const fileName = uriToFsPath(document.uri);
			const isProjectFile = new Set(parsedCommandLine.fileNames).has(fileName);
			const isReferenceFile = scriptSnapshots.has(fileName);
			if (isProjectFile || isReferenceFile) {
				const newVersion = ts.sys.createHash!(document.getText());
				scriptVersions.set(fileName, newVersion);
				await onProjectFilesUpdate(isProjectFile ? [document] : []);
			}
		}
		async function doValidation(changedDocs: TextDocument[]) {
			const req = ++projectCurrentReq;

			for (const doc of changedDocs) {
				if (req !== projectCurrentReq) break;
				await sendDiagnostics(doc, false);
			}

			const fileNames = new Set(parsedCommandLine.fileNames);
			const openedDocs = documents.all().filter(doc => doc.languageId === 'vue' && fileNames.has(uriToFsPath(doc.uri)));
			setTimeout(async () => {

				for (const doc of changedDocs) {
					if (req !== projectCurrentReq) break;
					await sendDiagnostics(doc, true);
				}

				setTimeout(async () => {
					for (const doc of openedDocs) {
						if (changedDocs.find(changeDoc => changeDoc.uri === doc.uri)) continue;
						if (req !== projectCurrentReq) break;
						await sendDiagnostics(doc, true);
					}
				}, 1000);
			}, 1000);
		}
		async function sendDiagnostics(document: TextDocument, withSideEffect: boolean) {
			const matchLs = best(document.uri);
			if (matchLs !== vueLanguageService) return;

			const req = (fileCurrentReqs.get(document.uri) ?? 0) + 1;
			const docVersion = document.version;
			fileCurrentReqs.set(document.uri, req);
			let _isCancle = false;
			const isCancel = async () => {
				if (_isCancle) {
					return true;
				}
				if (fileCurrentReqs.get(document.uri) !== req) {
					_isCancle = true;
					return true;
				}
				if (getDocVersionForDiag) {
					const clientDocVersion = await getDocVersionForDiag(document.uri);
					if (clientDocVersion !== undefined && docVersion !== clientDocVersion) {
						_isCancle = true;
						return true;
					}
				}
				return false;
			};

			await vueLanguageService.doValidation(document, async result => {
				connection.sendDiagnostics({ uri: document.uri, diagnostics: result });
			}, isCancel, withSideEffect);
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
			if (_onProjectFilesUpdate) {
				_onProjectFilesUpdate();
			}
			if (getDocVersionForDiag) {
				while (currentValidation) {
					await currentValidation;
				}
				currentValidation = doValidation(changedDocs);
				await currentValidation;
				currentValidation = undefined;
			}
		}
		function createLanguageServiceHost() {

			const host: LanguageServiceHost = {
				// ts
				getNewLine: () => ts.sys.newLine,
				useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
				readFile: ts.sys.readFile,
				writeFile: ts.sys.writeFile,
				fileExists: ts.sys.fileExists,
				directoryExists: ts.sys.directoryExists,
				getDirectories: ts.sys.getDirectories,
				readDirectory: ts.sys.readDirectory,
				realpath: ts.sys.realpath,
				// custom
				getProjectVersion: () => projectVersion.toString(),
				getScriptFileNames,
				getScriptVersion,
				getScriptSnapshot,
				getCurrentDirectory: () => upath.dirname(tsConfig),
				getCompilationSettings: () => parsedCommandLine.options,
				getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
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
			vueLanguageService.dispose();
			for (const disposable of disposables) {
				disposable.dispose();
			}
		}
	}
}
