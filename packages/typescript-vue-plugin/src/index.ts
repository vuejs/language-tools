import * as vue from '@volar/vue-typescript';
import * as shared from '@volar/shared';
import * as path from 'upath';
import * as apis from './apis';
import { createBasicRuntime } from '@volar/vue-typescript';

const init: ts.server.PluginModuleFactory = (modules) => {
	const { typescript: ts } = modules;
	const vueFilesGetter = new WeakMap<ts.server.Project, () => string[]>();
	const pluginModule: ts.server.PluginModule = {
		create(info) {

			// fix: https://github.com/johnsoncodehk/volar/issues/205
			info.project.getScriptKind = fileName => {
				switch (path.extname(fileName)) {
					case '.vue': return ts.ScriptKind.TSX; // can't use External, Unknown
					case '.js': return ts.ScriptKind.JS;
					case '.jsx': return ts.ScriptKind.JSX;
					case '.ts': return ts.ScriptKind.TS;
					case '.tsx': return ts.ScriptKind.TSX;
					case '.json': return ts.ScriptKind.JSON;
					default: return ts.ScriptKind.Unknown;
				}
			};

			const proxyHost = createProxyHost(ts, info);
			const services = createBasicRuntime();
			const compilerOptions = proxyHost.host.getVueCompilationSettings?.() ?? {};
			const tsRuntime = vue.createTypeScriptRuntime({ typescript: ts, ...services, compilerOptions }, proxyHost.host, true);
			const _tsPluginApis = apis.register(tsRuntime.context);
			const tsPluginProxy: Partial<ts.LanguageService> = {
				getSemanticDiagnostics: tsRuntime.apiHook(tsRuntime.context.scriptTsLsRaw.getSemanticDiagnostics, false),
				getEncodedSemanticClassifications: tsRuntime.apiHook(tsRuntime.context.scriptTsLsRaw.getEncodedSemanticClassifications, false),
				getCompletionsAtPosition: tsRuntime.apiHook(_tsPluginApis.getCompletionsAtPosition, false),
				getCompletionEntryDetails: tsRuntime.apiHook(tsRuntime.context.scriptTsLsRaw.getCompletionEntryDetails, false), // not sure
				getCompletionEntrySymbol: tsRuntime.apiHook(tsRuntime.context.scriptTsLsRaw.getCompletionEntrySymbol, false), // not sure
				getQuickInfoAtPosition: tsRuntime.apiHook(tsRuntime.context.scriptTsLsRaw.getQuickInfoAtPosition, false),
				getSignatureHelpItems: tsRuntime.apiHook(tsRuntime.context.scriptTsLsRaw.getSignatureHelpItems, false),
				getRenameInfo: tsRuntime.apiHook(tsRuntime.context.scriptTsLsRaw.getRenameInfo, false),

				findRenameLocations: tsRuntime.apiHook(_tsPluginApis.findRenameLocations, true),
				getDefinitionAtPosition: tsRuntime.apiHook(_tsPluginApis.getDefinitionAtPosition, false),
				getDefinitionAndBoundSpan: tsRuntime.apiHook(_tsPluginApis.getDefinitionAndBoundSpan, false),
				getTypeDefinitionAtPosition: tsRuntime.apiHook(_tsPluginApis.getTypeDefinitionAtPosition, false),
				getImplementationAtPosition: tsRuntime.apiHook(_tsPluginApis.getImplementationAtPosition, false),
				getReferencesAtPosition: tsRuntime.apiHook(_tsPluginApis.getReferencesAtPosition, true),
				findReferences: tsRuntime.apiHook(_tsPluginApis.findReferences, true),

				// TODO: now is handle by vue server
				// prepareCallHierarchy: tsRuntime.apiHook(tsLanguageService.rawLs.prepareCallHierarchy, false),
				// provideCallHierarchyIncomingCalls: tsRuntime.apiHook(tsLanguageService.rawLs.provideCallHierarchyIncomingCalls, false),
				// provideCallHierarchyOutgoingCalls: tsRuntime.apiHook(tsLanguageService.rawLs.provideCallHierarchyOutgoingCalls, false),
				// getEditsForFileRename: tsRuntime.apiHook(tsLanguageService.rawLs.getEditsForFileRename, false),

				// TODO
				// getCodeFixesAtPosition: tsRuntime.apiHook(tsLanguageService.rawLs.getCodeFixesAtPosition, false),
				// getCombinedCodeFix: tsRuntime.apiHook(tsLanguageService.rawLs.getCombinedCodeFix, false),
				// applyCodeActionCommand: tsRuntime.apiHook(tsLanguageService.rawLs.applyCodeActionCommand, false),
				// getApplicableRefactors: tsRuntime.apiHook(tsLanguageService.rawLs.getApplicableRefactors, false),
				// getEditsForRefactor: tsRuntime.apiHook(tsLanguageService.rawLs.getEditsForRefactor, false),
			};

			vueFilesGetter.set(info.project, proxyHost.getVueFiles);

			return new Proxy(info.languageService, {
				get: (target: any, property: keyof ts.LanguageService) => {
					return tsPluginProxy[property] || target[property];
				},
			});
		},
		getExternalFiles(project) {
			const getVueFiles = vueFilesGetter.get(project);
			if (!getVueFiles) {
				return [];
			}
			return getVueFiles().filter(fileName => project.fileExists(fileName));
		},
	}
	return pluginModule;
};

export = init;

function createProxyHost(ts: typeof import('typescript/lib/tsserverlibrary'), info: ts.server.PluginCreateInfo) {

	let projectVersion = 0;
	let reloadVueFilesSeq = 0;
	let sendDiagSeq = 0;
	let disposed = false;

	const vueFiles = new Map<string, {
		fileWatcher: ts.FileWatcher,
		version: number,
		snapshots: ts.IScriptSnapshot | undefined,
		snapshotsVersion: string | undefined,
	}>();
	const host: vue.LanguageServiceHostBase = {
		getNewLine: () => info.project.getNewLine(),
		useCaseSensitiveFileNames: () => info.project.useCaseSensitiveFileNames(),
		readFile: path => info.project.readFile(path),
		writeFile: (path, content) => info.project.writeFile(path, content),
		fileExists: path => info.project.fileExists(path),
		directoryExists: path => info.project.directoryExists(path),
		getDirectories: path => info.project.getDirectories(path),
		readDirectory: (path, extensions, exclude, include, depth) => info.project.readDirectory(path, extensions, exclude, include, depth),
		realpath: info.project.realpath ? path => info.project.realpath!(path) : undefined,

		getCompilationSettings: () => info.project.getCompilationSettings(),
		getVueCompilationSettings: () => parsedCommandLine?.vueOptions ?? {},
		getCurrentDirectory: () => info.project.getCurrentDirectory(),
		getDefaultLibFileName: () => info.project.getDefaultLibFileName(),
		getProjectVersion: () => info.project.getProjectVersion(),
		getVueProjectVersion: () => projectVersion.toString(),
		getProjectReferences: () => info.project.getProjectReferences(),

		getScriptFileNames,
		getScriptVersion,
		getScriptSnapshot,
	};

	update();

	const directoryWatcher = info.serverHost.watchDirectory(info.project.getCurrentDirectory(), onAnyDriveFileUpdated, true);
	const projectName = info.project.projectName;

	let tsconfigWatcher = info.project.fileExists(projectName)
		? info.serverHost.watchFile(projectName, () => {
			onConfigUpdated();
			onProjectUpdated();
			parsedCommandLine = shared.createParsedCommandLine(ts, ts.sys, projectName);
		})
		: undefined;
	let parsedCommandLine = tsconfigWatcher // reuse fileExists result
		? shared.createParsedCommandLine(ts, ts.sys, projectName)
		: undefined;

	return {
		host,
		getVueFiles: () => [...vueFiles.keys()],
		dispose,
	};

	async function onAnyDriveFileUpdated(fileName: string) {
		if (fileName.endsWith('.vue') && info.project.fileExists(fileName) && !vueFiles.has(fileName)) {
			onConfigUpdated();
		}
	}
	async function onConfigUpdated() {
		const seq = ++reloadVueFilesSeq;
		await shared.sleep(100);
		if (seq === reloadVueFilesSeq && !disposed) {
			update();
		}
	}
	function getScriptFileNames() {
		return info.project.getScriptFileNames().concat([...vueFiles.keys()]);
	}
	function getScriptVersion(fileName: string) {
		if (vueFiles.has(fileName)) {
			return vueFiles.get(fileName)!.version.toString();
		}
		return info.project.getScriptVersion(fileName);
	}
	function getScriptSnapshot(fileName: string) {
		if (vueFiles.has(fileName)) {
			const version = getScriptVersion(fileName);
			const file = vueFiles.get(fileName)!;
			if (file.snapshotsVersion !== version) {
				const text = getScriptText(fileName);
				if (text === undefined) return;
				file.snapshots = ts.ScriptSnapshot.fromString(text);
				file.snapshotsVersion = version;
				return file.snapshots;
			}
			return file.snapshots;
		}
		return info.project.getScriptSnapshot(fileName);
	}
	function getScriptText(fileName: string) {
		if (info.project.fileExists(fileName)) {
			return info.project.readFile(fileName);
		}
	}
	function getVueFiles() {
		const parseConfigHost: ts.ParseConfigHost = {
			useCaseSensitiveFileNames: info.project.useCaseSensitiveFileNames(),
			readDirectory: (path, extensions, exclude, include, depth) => {
				return info.project.readDirectory(path, ['.vue'], exclude, include, depth);
			},
			fileExists: fileName => info.project.fileExists(fileName),
			readFile: fileName => info.project.readFile(fileName),
		};

		const { fileNames } = ts.parseJsonConfigFileContent({}, parseConfigHost, info.project.getCurrentDirectory(), info.project.getCompilerOptions());
		return fileNames;
	}
	function update() {
		const newVueFiles = new Set(getVueFiles());
		let changed = false;
		for (const fileName of vueFiles.keys()) {
			if (!newVueFiles.has(fileName)) {
				vueFiles.get(fileName)?.fileWatcher.close();
				vueFiles.delete(fileName);
				changed = true;
			}
		}
		for (const fileName of newVueFiles) {
			if (!vueFiles.has(fileName)) {
				const fileWatcher = info.serverHost.watchFile(fileName, (_, eventKind) => {
					if (eventKind === ts.FileWatcherEventKind.Changed) {
						onFileChanged(fileName);
					}
					else if (eventKind === ts.FileWatcherEventKind.Deleted) {
						vueFiles.get(fileName)?.fileWatcher.close();
						vueFiles.delete(fileName);
						onProjectUpdated();
					}
				});
				vueFiles.set(fileName, {
					fileWatcher,
					version: 0,
					snapshots: undefined,
					snapshotsVersion: undefined,
				});
				changed = true;
			}
		}
		if (changed) {
			onProjectUpdated();
		}
	}
	function onFileChanged(fileName: string) {
		fileName = path.resolve(fileName);
		const file = vueFiles.get(fileName);
		if (file) {
			file.version++;
		}
		onProjectUpdated();
	}
	async function onProjectUpdated() {
		projectVersion++;
		const seq = ++sendDiagSeq;
		await shared.sleep(100);
		if (seq === sendDiagSeq) {
			info.project.refreshDiagnostics();
		}
	}
	function dispose() {
		directoryWatcher.close();
		if (tsconfigWatcher) {
			tsconfigWatcher.close();
		}
		for (const [_, file] of vueFiles) {
			file.fileWatcher.close();
		}
		disposed = true;
	}
}
