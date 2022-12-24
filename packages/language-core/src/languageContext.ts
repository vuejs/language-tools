import { posix as path } from 'path';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { createVirtualFilesHost, forEachEmbeddeds } from './documentRegistry';
import { LanguageModule, VirtualFile, LanguageServiceHost, EmbeddedFileKind } from './types';

export type EmbeddedLanguageContext = ReturnType<typeof createEmbeddedLanguageServiceHost>;

export function createEmbeddedLanguageServiceHost(
	host: LanguageServiceHost,
	languageModules: LanguageModule[],
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

	const documentRegistry = createVirtualFilesHost(languageModules);
	const ts = host.getTypeScriptModule();
	const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
	const sourceTsFileVersions = new Map<string, string>();
	const sourceVueFileVersions = new Map<string, string>();
	const virtualFileVersions = new Map<string, string>();
	const _tsHost: Partial<ts.LanguageServiceHost> = {
		fileExists: host.fileExists
			? fileName => {

				// .vue.js -> .vue
				// .vue.ts -> .vue
				// .vue.d.ts -> [ignored]
				const vueFileName = fileName.substring(0, fileName.lastIndexOf('.'));

				if (!documentRegistry.has(vueFileName)) {
					// create virtual files
					const scriptSnapshot = host.getScriptSnapshot(vueFileName);
					if (scriptSnapshot) {
						documentRegistry.update(vueFileName, scriptSnapshot);
					}
				}

				if (documentRegistry.getSourceByVirtualFileName(fileName)) {
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
			for (const [fileName] of documentRegistry.all()) {
				const vuePath2 = path.join(_path, path.basename(fileName));
				if (path.relative(_path.toLowerCase(), fileName.toLowerCase()).startsWith('..')) {
					continue;
				}
				if (!depth && fileName.toLowerCase() === vuePath2.toLowerCase()) {
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
				return ts.ScriptKind.Deferred;

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
		const shouldUpdate = newProjectVersion === undefined || newProjectVersion !== lastProjectVersion;

		lastProjectVersion = newProjectVersion;

		if (!shouldUpdate)
			return;

		let tsFileUpdated = false;

		const checkRemains = new Set(host.getScriptFileNames());
		const sourceFilesShouldUpdate: [string, VirtualFile, ts.IScriptSnapshot][] = [];

		// .vue
		for (const [fileName, _, virtualFile] of documentRegistry.all()) {
			checkRemains.delete(fileName);

			const snapshot = host.getScriptSnapshot(fileName);
			if (!snapshot) {
				// delete
				documentRegistry.update(fileName, undefined);
				tsFileUpdated = true;
				continue;
			}

			const newVersion = host.getScriptVersion(fileName);
			if (sourceVueFileVersions.get(fileName) !== newVersion) {
				// update
				sourceVueFileVersions.set(fileName, newVersion);
				sourceFilesShouldUpdate.push([fileName, virtualFile, snapshot]);
			}
		}

		// no any vue file version change, it mean project version was update by ts file change at this time
		if (!sourceFilesShouldUpdate.length) {
			tsFileUpdated = true;
		}

		// add
		for (const fileName of [...checkRemains]) {
			const snapshot = host.getScriptSnapshot(fileName);
			if (snapshot) {
				const virtualFile = documentRegistry.update(fileName, snapshot);
				if (virtualFile) {
					checkRemains.delete(fileName);
				}
			}
		}

		// .ts / .js / .d.ts / .json ...
		for (const [oldTsFileName, oldTsFileVersion] of [...sourceTsFileVersions]) {
			const newVersion = host.getScriptVersion(oldTsFileName);
			if (oldTsFileVersion !== newVersion) {
				if (!checkRemains.has(oldTsFileName) && !host.getScriptSnapshot(oldTsFileName)) {
					// delete
					sourceTsFileVersions.delete(oldTsFileName);
				}
				else {
					// update
					sourceTsFileVersions.set(oldTsFileName, newVersion);
				}
				tsFileUpdated = true;
			}
		}

		for (const nowFileName of checkRemains) {
			if (!sourceTsFileVersions.has(nowFileName)) {
				// add
				const newVersion = host.getScriptVersion(nowFileName);
				sourceTsFileVersions.set(nowFileName, newVersion);
				tsFileUpdated = true;
			}
		}

		for (const [fileName, virtualFile, snapshot] of sourceFilesShouldUpdate) {

			forEachEmbeddeds(virtualFile, embedded => {
				virtualFileVersions.delete(embedded.fileName);
			});

			const oldScripts: Record<string, string> = {};
			const newScripts: Record<string, string> = {};

			if (!tsFileUpdated) {
				forEachEmbeddeds(virtualFile, embedded => {
					if (embedded.kind === EmbeddedFileKind.TypeScriptHostFile) {
						oldScripts[embedded.fileName] = embedded.text;
					}
				});
			}

			documentRegistry.update(fileName, snapshot);

			if (!tsFileUpdated) {
				forEachEmbeddeds(virtualFile, embedded => {
					if (embedded.kind === EmbeddedFileKind.TypeScriptHostFile) {
						newScripts[embedded.fileName] = embedded.text;
					}
				});
			}

			if (
				!tsFileUpdated
				&& Object.keys(oldScripts).length !== Object.keys(newScripts).length
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

		const tsFileNames = new Set<string>();

		for (const [_1, _2, sourceFile] of documentRegistry.all()) {
			forEachEmbeddeds(sourceFile, embedded => {
				if (embedded.kind === EmbeddedFileKind.TypeScriptHostFile) {
					tsFileNames.add(embedded.fileName); // virtual .ts
				}
			});
		}

		for (const fileName of host.getScriptFileNames()) {
			if (!documentRegistry.has(fileName)) {
				tsFileNames.add(fileName); // .ts
			}
		}

		return [...tsFileNames];
	}
	function getScriptVersion(fileName: string) {
		let source = documentRegistry.getSourceByVirtualFileName(fileName);
		if (source) {
			if (virtualFileVersions.has(source[2].fileName)) {
				return virtualFileVersions.get(source[2].fileName)!;
			}
			else {
				let version = ts.sys?.createHash?.(source[2].text) ?? source[2].text;
				if (host.isTsc) {
					// fix https://github.com/johnsoncodehk/volar/issues/1082
					version = host.getScriptVersion(source[0]) + ':' + version;
				}
				virtualFileVersions.set(source[2].fileName, version);
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
		const source = documentRegistry.getSourceByVirtualFileName(fileName);
		if (source) {
			const snapshot = ts.ScriptSnapshot.fromString(source[2].text);
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
