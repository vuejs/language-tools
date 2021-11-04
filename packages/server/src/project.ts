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

export function createProject(
	ts: vue.Modules['typescript'],
	options: shared.ServerInitializationOptions,
	rootPath: string,
	tsConfig: string | ts.CompilerOptions,
	tsLocalized: ts.MapLike<string> | undefined,
	documents: vscode.TextDocuments<TextDocument>,
	workDoneProgress: vscode.WorkDoneProgressServerReporter,
	connection: vscode.Connection,
	lsConfigs: ReturnType<typeof createLsConfigs> | undefined,
) {

	let typeRootVersion = 0;
	let tsProjectVersion = 0;
	let vueProjectVersion = 0;
	let parsedCommandLine: ts.ParsedCommandLine;
	let vueLs: vue.LanguageService | undefined;
	const scripts = shared.createPathMap<{
		version: number,
		snapshot: ts.IScriptSnapshot | undefined,
		snapshotVersion: number | undefined,
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
			vueLs = vue.createLanguageService({ typescript: ts }, languageServiceHost);
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
	async function init() {
		await Promise.all([...fileRenamings]);
		parsedCommandLine = createParsedCommandLine();
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
			// ts
			getHtmlHoverSettings: lsConfigs?.getHtmlHoverSettings,
			getNewLine: () => ts.sys.newLine,
			useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
			readFile: (path, encoding) => ts.sys.readFile(resolveAbsolutePath(path), encoding),
			writeFile: (path, content) => ts.sys.writeFile(resolveAbsolutePath(path), content),
			directoryExists: path => ts.sys.directoryExists(resolveAbsolutePath(path)),
			getDirectories: path => ts.sys.getDirectories(resolveAbsolutePath(path)),
			readDirectory: (path, extensions, exclude, include, depth) => ts.sys.readDirectory(resolveAbsolutePath(path), extensions, exclude, include, depth),
			realpath: ts.sys.realpath ? path => ts.sys.realpath!(resolveAbsolutePath(path)) : undefined,
			fileExists: path => ts.sys.fileExists(resolveAbsolutePath(path)),
			getProjectReferences: () => parsedCommandLine.projectReferences, // if circular, broken with provide `getParsedCommandLine: () => parsedCommandLine`
			// custom
			getDefaultLibFileName: options => ts.getDefaultLibFilePath(options), // TODO: vscode option for ts lib
			getProjectVersion: () => tsProjectVersion.toString(),
			getVueProjectVersion: () => vueProjectVersion.toString(),
			getTypeRootsVersion: () => typeRootVersion,
			getScriptFileNames: () => parsedCommandLine.fileNames,
			getCurrentDirectory: () => rootPath,
			getCompilationSettings: () => parsedCommandLine.options,
			getVueCompilationSettings: () => parsedCommandLine.raw?.vueCompilerOptions ?? {},
			getScriptVersion,
			getScriptSnapshot,
		};

		if (tsLocalized) {
			host.getLocalizedDiagnosticMessages = () => tsLocalized;
		}

		return host;

		function resolveAbsolutePath(_path: string) {
			return !path.isAbsolute(_path) ? path.join(rootPath, _path) : _path;
		}
		function getScriptVersion(fileName: string) {
			return scripts.fsPathGet(fileName)?.version.toString()
				?? '';
		}
		function getScriptSnapshot(fileName: string) {
			const script = scripts.fsPathGet(fileName);
			if (script && script.snapshotVersion === script.version) {
				return script.snapshot;
			}
			const text = getScriptText(ts, documents, fileName);
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
	function dispose() {
		if (vueLs) {
			vueLs.dispose();
		}
		for (const disposable of disposables) {
			disposable.dispose();
		}
		scripts.clear();
		disposables.length = 0;
	}
	function createParsedCommandLine() {
		const parseConfigHost: ts.ParseConfigHost = {
			useCaseSensitiveFileNames: languageServiceHost.useCaseSensitiveFileNames?.() ?? ts.sys.useCaseSensitiveFileNames,
			readDirectory: (path, extensions, exclude, include, depth) => {
				return (languageServiceHost.readDirectory ?? ts.sys.readDirectory)(path, [...extensions, '.vue'], exclude, include, depth);
			},
			fileExists: languageServiceHost.fileExists ?? ts.sys.fileExists,
			readFile: languageServiceHost.readFile ?? ts.sys.readFile,
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
