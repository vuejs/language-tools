import * as vue from '@volar/vue-typescript';
import * as path from 'path';
import * as apis from './apis';
import { tsShared } from '@volar/vue-typescript';

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
			const vueCompilerOptions = proxyHost.host.getVueCompilationSettings?.() ?? {};
			const tsRuntime = vue.createTypeScriptRuntime({
				typescript: ts,
				vueCompilerOptions,
				getCssClasses: () => ({}),
				getCssVBindRanges: () => [],
				vueLsHost: proxyHost.host,
				isTsPlugin: true
			});
			const _tsPluginApis = apis.register(tsRuntime);
			const tsPluginProxy: Partial<ts.LanguageService> = {
				getSemanticDiagnostics: apiHook(tsRuntime.getTsLs('script').getSemanticDiagnostics, false),
				getEncodedSemanticClassifications: apiHook(tsRuntime.getTsLs('script').getEncodedSemanticClassifications, false),
				getCompletionsAtPosition: apiHook(_tsPluginApis.getCompletionsAtPosition, false),
				getCompletionEntryDetails: apiHook(tsRuntime.getTsLs('script').getCompletionEntryDetails, false), // not sure
				getCompletionEntrySymbol: apiHook(tsRuntime.getTsLs('script').getCompletionEntrySymbol, false), // not sure
				getQuickInfoAtPosition: apiHook(tsRuntime.getTsLs('script').getQuickInfoAtPosition, false),
				getSignatureHelpItems: apiHook(tsRuntime.getTsLs('script').getSignatureHelpItems, false),
				getRenameInfo: apiHook(tsRuntime.getTsLs('script').getRenameInfo, false),

				findRenameLocations: apiHook(_tsPluginApis.findRenameLocations, true),
				getDefinitionAtPosition: apiHook(_tsPluginApis.getDefinitionAtPosition, false),
				getDefinitionAndBoundSpan: apiHook(_tsPluginApis.getDefinitionAndBoundSpan, false),
				getTypeDefinitionAtPosition: apiHook(_tsPluginApis.getTypeDefinitionAtPosition, false),
				getImplementationAtPosition: apiHook(_tsPluginApis.getImplementationAtPosition, false),
				getReferencesAtPosition: apiHook(_tsPluginApis.getReferencesAtPosition, true),
				findReferences: apiHook(_tsPluginApis.findReferences, true),

				// TODO: now is handle by vue server
				// prepareCallHierarchy: apiHook(tsLanguageService.rawLs.prepareCallHierarchy, false),
				// provideCallHierarchyIncomingCalls: apiHook(tsLanguageService.rawLs.provideCallHierarchyIncomingCalls, false),
				// provideCallHierarchyOutgoingCalls: apiHook(tsLanguageService.rawLs.provideCallHierarchyOutgoingCalls, false),
				// getEditsForFileRename: apiHook(tsLanguageService.rawLs.getEditsForFileRename, false),

				// TODO
				// getCodeFixesAtPosition: apiHook(tsLanguageService.rawLs.getCodeFixesAtPosition, false),
				// getCombinedCodeFix: apiHook(tsLanguageService.rawLs.getCombinedCodeFix, false),
				// applyCodeActionCommand: apiHook(tsLanguageService.rawLs.applyCodeActionCommand, false),
				// getApplicableRefactors: apiHook(tsLanguageService.rawLs.getApplicableRefactors, false),
				// getEditsForRefactor: apiHook(tsLanguageService.rawLs.getEditsForRefactor, false),
			};

			vueFilesGetter.set(info.project, proxyHost.getVueFiles);

			return new Proxy(info.languageService, {
				get: (target: any, property: keyof ts.LanguageService) => {
					return tsPluginProxy[property] || target[property];
				},
			});

			function apiHook<T extends (...args: any) => any>(
				api: T,
				shouldUpdateTemplateScript: boolean | ((...args: Parameters<T>) => boolean) = true,
			) {
				const handler = {
					apply(target: (...args: any) => any, thisArg: any, argumentsList: Parameters<T>) {
						const _shouldUpdateTemplateScript = typeof shouldUpdateTemplateScript === 'boolean' ? shouldUpdateTemplateScript : shouldUpdateTemplateScript.apply(null, argumentsList);
						tsRuntime.update(_shouldUpdateTemplateScript);
						return target.apply(thisArg, argumentsList);
					}
				};
				return new Proxy<T>(api, handler);
			}
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
	const host: vue.LanguageServiceHost = {
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
			parsedCommandLine = tsShared.createParsedCommandLine(ts, ts.sys, projectName);
		})
		: undefined;
	let parsedCommandLine = tsconfigWatcher // reuse fileExists result
		? tsShared.createParsedCommandLine(ts, ts.sys, projectName)
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
		await sleep(100);
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
		await sleep(100);
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

function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
