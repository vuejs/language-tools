import * as vue from 'vscode-vue-languageservice'
import * as shared from '@volar/shared';
import * as path from 'upath';

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
			const vueLs = vue.createLanguageService(modules, proxyHost.host, true);

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
		createTsLanguageService(host) {
			return shared.createTsLanguageService(ts, host)
		},
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
		getProjectVersion: () => info.project.getProjectVersion(),
		getVueProjectVersion: () => projectVersion.toString(),

		getScriptFileNames,
		getScriptVersion,
		getScriptSnapshot,
	};

	update();

	const directoryWatcher = info.serverHost.watchDirectory(info.project.getCurrentDirectory(), onAnyDriveFileUpdated, true);

	let tsconfigWatcher = info.project.fileExists(info.project.projectName)
		? info.serverHost.watchFile(info.project.projectName, () => {
			onConfigUpdated();
			onProjectUpdated();
		})
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
