import * as shared from '@volar/shared';
import * as vue from 'vscode-vue-languageservice';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
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
	workDoneProgress: vscode.WorkDoneProgressServerReporter,
	connection: vscode.Connection,
	lsConfigs: ReturnType<typeof createLsConfigs>,
) {

	let typeRootVersion = 0;
	let tsProjectVersion = 0;
	let vueProjectVersion = 0;
	let parsedCommandLine: ts.ParsedCommandLine;
	let vueLs: vue.LanguageService | undefined;
	const scripts = new shared.FsPathMap<{
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
	async function onWorkspaceFilesChanged(changes: vscode.FileEvent[]) {

		await Promise.all([...fileRenamings]);

		for (const change of changes) {

			const fileName = shared.uriToFsPath(change.uri);
			const script = scripts.get(fileName);

			if (script && change.type === vscode.FileChangeType.Changed) {
				script.version++;
			}
			else if (script && change.type === vscode.FileChangeType.Deleted) {
				scripts.delete(fileName);
			}

			updateProjectVersion(fileName);
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

		const fileName = shared.uriToFsPath(document.uri);
		const script = scripts.get(fileName);
		if (script) {
			script.version = document.version;
		}

		updateProjectVersion(fileName);
	}
	function updateProjectVersion(changedFileName: string) {
		if (changedFileName.endsWith('.vue')) {
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
			fileExists: ts.sys.fileExists,
			// custom
			getDefaultLibFileName: options => ts.getDefaultLibFilePath(options), // TODO: vscode option for ts lib
			getProjectVersion: () => tsProjectVersion.toString(),
			getVueProjectVersion: () => vueProjectVersion.toString(),
			getTypeRootsVersion: () => typeRootVersion,
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

		function getScriptVersion(fileName: string) {
			return scripts.get(fileName)?.version.toString()
				?? '';
		}
		function getScriptSnapshot(fileName: string) {
			const script = scripts.get(fileName);
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
					scripts.set(fileName, {
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
