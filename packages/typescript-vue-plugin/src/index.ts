import { createLanguageService } from '@volar/vscode-vue-languageservice'
import { sleep } from '@volar/shared';
import * as path from 'upath';

export = function init(modules: { typescript: typeof import('typescript/lib/tsserverlibrary') }) {
	const ts = modules.typescript;
	const vueFilesGetter = new WeakMap<ts.server.Project, () => string[]>();

	return {
		create,
		getExternalFiles,
	};

	function create(info: ts.server.PluginCreateInfo): ts.LanguageService {

		const proxyHost = createProxyHost(ts, info);
		const vueLs = createLanguageService(proxyHost.host, { typescript: ts }, undefined, true);

		vueFilesGetter.set(info.project, proxyHost.getVueFiles);

		return new Proxy(info.languageService, {
			get: (target: any, property: keyof ts.LanguageService) => {
				return vueLs.tsPlugin[property] || target[property];
			},
		});
	}
	function getExternalFiles(project: ts.server.Project): string[] {
		const getVueFiles = vueFilesGetter.get(project);
		if (!getVueFiles) {
			return [];
		}
		return getVueFiles().filter(fileName => project.fileExists(fileName));
	}
}

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

	checkFilesUpdate();

	const directoryWatcher = info.serverHost.watchDirectory(info.project.getCurrentDirectory(), async fileName => {
		anyFilesChanged = true;
		await sleep(0);
		if (anyFilesChanged && !disposed) {
			anyFilesChanged = false;
			vueFiles = new Set(getVueFiles());
			checkFilesUpdate();
		}
	}, true);

	return {
		host,
		getVueFiles: () => [...vueFiles],
		dispose,
	};

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
			fileExists: info.project.fileExists,
			readFile: info.project.readFile,
		};

		const tsConfig = info.project.projectName;
		const json = info.project.readFile(tsConfig);
		if (!json) return [];
		let parsedJson = {};
		try { parsedJson = JSON.parse(json); } catch { }
		const content = ts.parseJsonConfigFileContent(parsedJson, parseConfigHost, path.dirname(tsConfig), {}, path.basename(tsConfig));
		return content.fileNames;
	}
	function checkFilesUpdate() {
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
			onVueFilesUpdated();
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
		onVueFilesUpdated();
	}
	function onVueFilesUpdated() {
		projectVersion++;
		info.project.refreshDiagnostics();
	}
	function dispose() {
		directoryWatcher.close();
		for (const [_, fileWatcher] of fileWatchers) {
			fileWatcher.close();
		}
		disposed = true;
	}
}
