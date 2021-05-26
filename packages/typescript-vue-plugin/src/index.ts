import { createLanguageService } from 'vscode-vue-languageservice'
import { sleep } from '@volar/shared';
import * as path from 'upath';

const init: ts.server.PluginModuleFactory = (modules) => {
	const { typescript: ts } = modules;
	const vueFilesGetter = new WeakMap<ts.server.Project, () => string[]>();
	const pluginModule: ts.server.PluginModule = {
		create(info) {

			// fix: https://github.com/johnsoncodehk/volar/issues/205
			info.project.getScriptKind = fileName => {
				switch (path.extname(fileName)) {
					case '.vue': return ts.ScriptKind.JSON; // can't use External, Unknown
					case '.js': return ts.ScriptKind.JS;
					case '.jsx': return ts.ScriptKind.JSX;
					case '.ts': return ts.ScriptKind.TS;
					case '.tsx': return ts.ScriptKind.TSX;
					case '.json': return ts.ScriptKind.JSON;
					default: return ts.ScriptKind.Unknown;
				}
			};

			const proxyHost = createProxyHost(ts, info);
			const vueLs = createLanguageService(modules, proxyHost.host);

			vueFilesGetter.set(info.project, proxyHost.getVueFiles);

			return new Proxy(info.languageService, {
				get: (target: any, property: keyof ts.LanguageService) => {
					return vueLs.__internal__.tsPlugin[property] || target[property];
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
	let anyFilesChanged = false;
	let disposed = false;
	let vueFiles = new Set(getVueFiles());
	const fileWatchers = new Map<string, ts.FileWatcher>();
	const scriptVersions = new Map<string, string>();
	const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
	const host: ts.LanguageServiceHost = {
		getNewLine: () => ts.sys.newLine,
		useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
		readFile: ts.sys.readFile,
		writeFile: ts.sys.writeFile,
		fileExists: ts.sys.fileExists,
		directoryExists: ts.sys.directoryExists,
		getDirectories: ts.sys.getDirectories,
		readDirectory: ts.sys.readDirectory,
		realpath: ts.sys.realpath,

		getCompilationSettings: () => info.project.getCompilationSettings(),
		getCurrentDirectory: () => info.project.getCurrentDirectory(),
		getDefaultLibFileName: () => info.project.getDefaultLibFileName(),

		getProjectVersion,
		getScriptFileNames,
		getScriptVersion,
		getScriptSnapshot,
	};

	checkFilesAddRemove();

	const directoryWatcher = info.serverHost.watchDirectory(info.project.getCurrentDirectory(), onFileChangedOrConfigUpdated, true);

	let tsconfigWatcher = info.project.fileExists(info.project.projectName)
		? info.serverHost.watchFile(info.project.projectName, () => {
			onFileChangedOrConfigUpdated();
			onProjectUpdated();
		})
		: undefined;

	return {
		host,
		getVueFiles: () => [...vueFiles],
		dispose,
	};

	async function onFileChangedOrConfigUpdated() {
		anyFilesChanged = true;
		await sleep(0);
		if (anyFilesChanged && !disposed) {
			anyFilesChanged = false;
			vueFiles = new Set(getVueFiles());
			checkFilesAddRemove();
		}
	}
	function getProjectVersion() {
		return info.project.getProjectVersion() + ':' + projectVersion.toString();
	}
	function getScriptFileNames() {
		return info.project.getScriptFileNames().concat([...vueFiles]);
	}
	function getScriptVersion(fileName: string) {
		if (vueFiles.has(fileName)) {
			return scriptVersions.get(fileName) ?? '';
		}
		return info.project.getScriptVersion(fileName);
	}
	function getScriptSnapshot(fileName: string) {
		if (vueFiles.has(fileName)) {
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
			return;
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
	function checkFilesAddRemove() {
		let changed = false;
		for (const fileName of fileWatchers.keys()) {
			if (!vueFiles.has(fileName)) {
				fileWatchers.get(fileName)!.close();
				fileWatchers.delete(fileName);
				changed = true;
			}
		}
		for (const fileName of vueFiles) {
			if (!fileWatchers.has(fileName)) {
				const fileWatcher = info.serverHost.watchFile(fileName, (fileName, eventKind) => {
					if (eventKind === ts.FileWatcherEventKind.Changed) {
						onFileChanged(fileName);
					}
				});
				fileWatchers.set(fileName, fileWatcher);
				changed = true;
			}
		}
		if (changed) {
			onProjectUpdated();
		}
	}
	function onFileChanged(fileName: string) {
		fileName = path.resolve(fileName);
		const oldVersion = scriptVersions.get(fileName);
		const oldVersionNum = Number(oldVersion);
		if (Number.isNaN(oldVersionNum)) {
			scriptVersions.set(fileName, '0');
		}
		else {
			scriptVersions.set(fileName, (oldVersionNum + 1).toString());
		}
		onProjectUpdated();
	}
	function onProjectUpdated() {
		projectVersion++;
		info.project.refreshDiagnostics();
	}
	function dispose() {
		directoryWatcher.close();
		if (tsconfigWatcher) {
			tsconfigWatcher.close();
		}
		for (const [_, fileWatcher] of fileWatchers) {
			fileWatcher.close();
		}
		disposed = true;
	}
}
