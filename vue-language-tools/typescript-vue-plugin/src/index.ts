import * as vue from '@volar/vue-language-core';
import * as vueTs from '@volar/vue-typescript';
import * as path from 'path';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as tsFaster from '@volar/typescript-faster';

const init: ts.server.PluginModuleFactory = (modules) => {
	const { typescript: ts } = modules;
	const vueFilesGetter = new WeakMap<ts.server.Project, () => string[]>();
	const pluginModule: ts.server.PluginModule = {
		create(info) {

			// fix: https://github.com/johnsoncodehk/volar/issues/1146
			if (info.project.projectKind === ts.server.ProjectKind.Inferred) {
				return info.languageService;
			}

			const proxyHost = createProxyHost(ts, info);

			if (proxyHost.getVueFiles().length === 0) {
				return info.languageService;
			}

			// fix: https://github.com/johnsoncodehk/volar/issues/205
			info.project.getScriptKind = fileName => {
				switch (path.extname(fileName)) {
					case '.vue': return ts.ScriptKind.Deferred;
					case '.js': return ts.ScriptKind.JS;
					case '.jsx': return ts.ScriptKind.JSX;
					case '.ts': return ts.ScriptKind.TS;
					case '.tsx': return ts.ScriptKind.TSX;
					case '.json': return ts.ScriptKind.JSON;
					default: return ts.ScriptKind.Unknown;
				}
			};

			const ls = vueTs.createLanguageService(proxyHost.host);

			tsFaster.decorate(ts, proxyHost.host, ls);

			vueFilesGetter.set(info.project, proxyHost.getVueFiles);

			return new Proxy(info.languageService, {
				get: (target: any, property: keyof ts.LanguageService) => {
					if (
						property === 'getSemanticDiagnostics'
						|| property === 'getEncodedSemanticClassifications'
						|| property === 'getCompletionsAtPosition'
						|| property === 'getCompletionEntryDetails'
						|| property === 'getCompletionEntrySymbol'
						|| property === 'getQuickInfoAtPosition'
						|| property === 'getSignatureHelpItems'
						|| property === 'getRenameInfo'
						|| property === 'findRenameLocations'
						|| property === 'getDefinitionAtPosition'
						|| property === 'getDefinitionAndBoundSpan'
						|| property === 'getTypeDefinitionAtPosition'
						|| property === 'getImplementationAtPosition'
						|| property === 'getReferencesAtPosition'
						|| property === 'findReferences'
					) {
						return ls[property];
					}
					return target[property];
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
	};
	return pluginModule;
};

export = init;

function createProxyHost(ts: typeof import('typescript/lib/tsserverlibrary'), info: ts.server.PluginCreateInfo) {

	let projectVersion = 0;
	let reloadVueFilesSeq = 0;
	let sendDiagSeq = 0;
	let disposed = false;

	const extraFileExtensions: ts.FileExtensionInfo[] = [{
		extension: 'vue',
		isMixedContent: true,
		scriptKind: ts.ScriptKind.Deferred,
	}];
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
		getProjectVersion: () => info.project.getProjectVersion() + '-' + projectVersion,
		getProjectReferences: () => info.project.getProjectReferences(),

		getScriptFileNames,
		getScriptVersion,
		getScriptSnapshot,

		getTypeScriptModule: () => ts,
		isTsPlugin: true,
	};

	update();

	const directoryWatcher = info.serverHost.watchDirectory(info.project.getCurrentDirectory(), onAnyDriveFileUpdated, true);
	const projectName = info.project.getProjectName();

	let tsconfigWatcher = info.project.fileExists(projectName)
		? info.serverHost.watchFile(projectName, () => {
			onConfigUpdated();
			onProjectUpdated();
			parsedCommandLine = vue.createParsedCommandLine(ts, ts.sys, projectName, extraFileExtensions);
		})
		: undefined;
	let parsedCommandLine = tsconfigWatcher // reuse fileExists result
		? vue.createParsedCommandLine(ts, ts.sys, projectName, extraFileExtensions)
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
			readDirectory: (path, extensions, exclude, include, depth) => info.project.readDirectory(path, extensions, exclude, include, depth),
			fileExists: fileName => info.project.fileExists(fileName),
			readFile: fileName => info.project.readFile(fileName),
		};
		// fix https://github.com/johnsoncodehk/volar/issues/1276
		// Should use raw tsconfig json not rootDir but seems cannot get it from plugin info
		const includeRoot = path.resolve(info.project.getCurrentDirectory(), info.project.getCompilerOptions().rootDir || '.');
		const { fileNames } = ts.parseJsonConfigFileContent({}, parseConfigHost, includeRoot, info.project.getCompilerOptions(), undefined /* TODO: info.project.config.configFilePath? */, undefined, extraFileExtensions);
		return fileNames.filter(fileName => extraFileExtensions.some(ext => fileName.endsWith('.' + ext.extension)));
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
