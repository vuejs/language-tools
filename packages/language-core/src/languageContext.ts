import { posix as path } from 'path';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { createDocumentRegistry, forEachEmbeddeds } from './documentRegistry';
import { EmbeddedLanguageModule, FileNode, LanguageServiceHost } from './types';

export type EmbeddedLanguageContext = ReturnType<typeof createEmbeddedLanguageServiceHost>;

export function createEmbeddedLanguageServiceHost(
	host: LanguageServiceHost,
	languageModules: EmbeddedLanguageModule[],
) {

	for (const languageModule of languageModules.reverse()) {
		if (languageModule.proxyLanguageServiceHost) {
			const proxyApis = languageModule.proxyLanguageServiceHost(host);
			host = new Proxy(host, {
				get(target, key: keyof ts.LanguageServiceHost) {
					if (key in proxyApis) {
						return proxyApis[key];
					}
					return target[key];
				},
			});
		}
	}

	let lastProjectVersion: string | undefined;
	let tsProjectVersion = 0;

	const documentRegistry = createDocumentRegistry();
	const ts = host.getTypeScriptModule();
	const tsFileVersions = new Map<string, string>();
	const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
	const fileVersions = new WeakMap<FileNode, string>();
	const embeddedLanguageSourceFileVersions = new WeakMap<FileNode, string>();
	const _tsHost: Partial<ts.LanguageServiceHost> = {
		fileExists: host.fileExists
			? fileName => {

				// .vue.js -> .vue
				// .vue.ts -> .vue
				// .vue.d.ts (never)
				const vueFileName = fileName.substring(0, fileName.lastIndexOf('.'));

				if (!documentRegistry.get(vueFileName)) {
					// create virtual files
					const scriptSnapshot = host.getScriptSnapshot(vueFileName);
					if (scriptSnapshot) {
						for (const langaugeModule of languageModules) {
							const sourceFile = langaugeModule.createSourceFile(vueFileName, scriptSnapshot);
							if (sourceFile) {
								documentRegistry.set(vueFileName, sourceFile, langaugeModule);
								break;
							}
						}
					}
				}

				if (!!documentRegistry.fromEmbeddedFileName(fileName)) {
					return true;
				}

				return !!host.fileExists?.(fileName);
			}
			: undefined,
		getProjectVersion: () => {
			return tsProjectVersion.toString();
		},
		getScriptFileNames,
		getScriptVersion,
		getScriptSnapshot,
		readDirectory: (_path, extensions, exclude, include, depth) => {
			const result = host.readDirectory?.(_path, extensions, exclude, include, depth) ?? [];
			for (const vuePath of documentRegistry.getFileNames()) {
				const vuePath2 = path.join(_path, path.basename(vuePath));
				if (path.relative(_path.toLowerCase(), vuePath.toLowerCase()).startsWith('..')) {
					continue;
				}
				if (!depth && vuePath.toLowerCase() === vuePath2.toLowerCase()) {
					result.push(vuePath2);
				}
				else if (depth) {
					result.push(vuePath2); // TODO: depth num
				}
			}
			return result;
		},
		getScriptKind(fileName) {

			if (documentRegistry.has(fileName))
				return ts.ScriptKind.TSX; // can't use External, Unknown

			switch (path.extname(fileName)) {
				case '.js': return ts.ScriptKind.JS;
				case '.jsx': return ts.ScriptKind.JSX;
				case '.ts': return ts.ScriptKind.TS;
				case '.tsx': return ts.ScriptKind.TSX;
				case '.json': return ts.ScriptKind.JSON;
				default: return ts.ScriptKind.Unknown;
			}
		},
	};

	return {
		typescriptLanguageServiceHost: new Proxy(_tsHost as ts.LanguageServiceHost, {
			get: (target, property: keyof ts.LanguageServiceHost) => {
				update();
				return target[property] || host[property];
			},
		}),
		mapper: new Proxy(documentRegistry, {
			get: (target, property) => {
				update();
				return target[property as keyof typeof documentRegistry];
			},
		}),
	};

	function update() {

		const newProjectVersion = host.getProjectVersion?.();
		const sholdUpdate = newProjectVersion === undefined || newProjectVersion !== lastProjectVersion;

		lastProjectVersion = newProjectVersion;

		if (!sholdUpdate)
			return;

		let tsFileUpdated = false;

		const remainFileNames = new Set(host.getScriptFileNames());
		const sourceFilesToUpdate: [FileNode, EmbeddedLanguageModule, ts.IScriptSnapshot][] = [];

		// .vue
		for (const [sourceFile, languageModule] of documentRegistry.getAll()) {
			remainFileNames.delete(sourceFile.fileName);
			const newVersion = host.getScriptVersion(sourceFile.fileName);
			if (embeddedLanguageSourceFileVersions.get(sourceFile) !== newVersion) {
				embeddedLanguageSourceFileVersions.set(sourceFile, newVersion);
				const snapshot = host.getScriptSnapshot(sourceFile.fileName);
				if (snapshot) {
					// update
					sourceFilesToUpdate.push([sourceFile, languageModule, snapshot]);
				}
				else {
					// delete
					if (documentRegistry.delete(sourceFile.fileName)) {
						tsFileUpdated = true;
					}
				}
			}
		}

		// add
		for (const fileName of [...remainFileNames]) {
			const snapshot = host.getScriptSnapshot(fileName);
			if (snapshot) {
				for (const languageModule of languageModules) {
					const sourceFile = languageModule.createSourceFile(fileName, snapshot);
					if (sourceFile) {
						documentRegistry.set(fileName, sourceFile, languageModule);
						remainFileNames.delete(fileName);
						break;
					}
				}
			}
		}

		// .ts / .js / .d.ts / .json ...
		for (const [oldTsFileName, oldTsFileVersion] of [...tsFileVersions]) {
			const newVersion = host.getScriptVersion(oldTsFileName);
			if (oldTsFileVersion !== newVersion) {
				if (!remainFileNames.has(oldTsFileName) && !host.getScriptSnapshot(oldTsFileName)) {
					// delete
					tsFileVersions.delete(oldTsFileName);
				}
				else {
					// update
					console.log('update ts file', oldTsFileName);
					tsFileVersions.set(oldTsFileName, newVersion);
				}
				tsFileUpdated = true;
			}
		}

		for (const nowFileName of remainFileNames) {
			if (!tsFileVersions.has(nowFileName)) {
				// add
				const newVersion = host.getScriptVersion(nowFileName);
				tsFileVersions.set(nowFileName, newVersion);
				tsFileUpdated = true;
			}
		}

		for (const [sourceFile, languageModule, snapshot] of sourceFilesToUpdate) {

			const oldScripts: Record<string, string> = {};
			const newScripts: Record<string, string> = {};

			if (!tsFileUpdated) {
				forEachEmbeddeds(sourceFile, embedded => {
					if (embedded.isTsHostFile) {
						oldScripts[embedded.fileName] = embedded.text;
					}
				});
			}

			languageModule.updateSourceFile(sourceFile, snapshot);

			if (!tsFileUpdated) {
				forEachEmbeddeds(sourceFile, embedded => {
					if (embedded.isTsHostFile) {
						newScripts[embedded.fileName] = embedded.text;
					}
				});
			}

			if (
				Object.keys(oldScripts).length !== Object.keys(newScripts).length
				|| Object.keys(oldScripts).some(fileName => oldScripts[fileName] !== newScripts[fileName])
			) {
				tsFileUpdated = true;
			}
		}

		if (tsFileUpdated) {
			tsProjectVersion++;
		}
	}
	function getScriptFileNames() {

		const tsFileNames: string[] = [];

		for (const mapped of documentRegistry.getAllEmbeddeds()) {
			if (mapped.embedded.isTsHostFile) {
				tsFileNames.push(mapped.embedded.fileName); // virtual .ts
			}
		}

		for (const fileName of host.getScriptFileNames()) {
			if (host.isTsPlugin) {
				tsFileNames.push(fileName); // .vue + .ts
			}
			else if (!documentRegistry.has(fileName)) {
				tsFileNames.push(fileName); // .ts
			}
		}

		return tsFileNames;
	}
	function getScriptVersion(fileName: string) {
		let mapped = documentRegistry.fromEmbeddedFileName(fileName);
		if (mapped) {
			if (fileVersions.has(mapped.embedded)) {
				return fileVersions.get(mapped.embedded)!;
			}
			else {
				let version = ts.sys?.createHash?.(mapped.embedded.text) ?? mapped.embedded.text;
				if (host.isTsc) {
					// fix https://github.com/johnsoncodehk/volar/issues/1082
					version = host.getScriptVersion(mapped.vueFile.fileName) + ':' + version;
				}
				fileVersions.set(mapped.embedded, version);
				return version;
			}
		}
		return host.getScriptVersion(fileName);
	}
	function getScriptSnapshot(fileName: string) {
		const version = getScriptVersion(fileName);
		const cache = scriptSnapshots.get(fileName.toLowerCase());
		if (cache && cache[0] === version) {
			return cache[1];
		}
		const mapped = documentRegistry.fromEmbeddedFileName(fileName);
		if (mapped) {
			const snapshot = ts.ScriptSnapshot.fromString(mapped.embedded.text);
			scriptSnapshots.set(fileName.toLowerCase(), [version, snapshot]);
			return snapshot;
		}
		let tsScript = host.getScriptSnapshot(fileName);
		if (tsScript) {
			scriptSnapshots.set(fileName.toLowerCase(), [version, tsScript]);
			return tsScript;
		}
	}
}
