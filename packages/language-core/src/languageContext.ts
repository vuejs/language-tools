import { posix as path } from 'path';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { createVirtualFiles, forEachEmbeddeds } from './documentRegistry';
import { LanguageModule, LanguageServiceHost, EmbeddedFileKind } from './types';

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

	const virtualFiles = createVirtualFiles(languageModules);
	const ts = host.getTypeScriptModule();
	const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
	const sourceTsFileVersions = new Map<string, string>();
	const sourceFileVersions = new Map<string, string>();
	const virtualFileVersions = new Map<string, { value: number, virtualFileSnapshot: ts.IScriptSnapshot, sourceFileSnapshot: ts.IScriptSnapshot; }>();
	const _tsHost: Partial<ts.LanguageServiceHost> = {
		fileExists: host.fileExists
			? fileName => {

				// .vue.js -> .vue
				// .vue.ts -> .vue
				// .vue.d.ts -> [ignored]
				const vueFileName = fileName.substring(0, fileName.lastIndexOf('.'));

				if (!virtualFiles.hasSourceFile(vueFileName)) {
					// create virtual files
					const scriptSnapshot = host.getScriptSnapshot(vueFileName);
					if (scriptSnapshot) {
						virtualFiles.update(vueFileName, scriptSnapshot);
					}
				}

				if (virtualFiles.getSourceByVirtualFileName(fileName)) {
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
			for (const [fileName] of virtualFiles.all()) {
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

			if (virtualFiles.hasSourceFile(fileName))
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
		mapper: new Proxy(virtualFiles, {
			get: (target, property) => {
				update();
				return target[property as keyof typeof virtualFiles];
			},
		}),
	};

	function update() {

		const newProjectVersion = host.getProjectVersion?.();
		const shouldUpdate = newProjectVersion === undefined || newProjectVersion !== lastProjectVersion;

		lastProjectVersion = newProjectVersion;

		if (!shouldUpdate)
			return;

		let shouldUpdateTsProject = false;
		let virtualFilesUpdatedNum = 0;

		const remainRootFiles = new Set(host.getScriptFileNames());

		// .vue
		for (const [fileName] of virtualFiles.all()) {
			remainRootFiles.delete(fileName);

			const snapshot = host.getScriptSnapshot(fileName);
			if (!snapshot) {
				// delete
				virtualFiles.delete(fileName);
				shouldUpdateTsProject = true;
				continue;
			}

			const newVersion = host.getScriptVersion(fileName);
			if (sourceFileVersions.get(fileName) !== newVersion) {
				// update
				sourceFileVersions.set(fileName, newVersion);
				virtualFiles.update(fileName, snapshot);
				virtualFilesUpdatedNum++;
			}
		}

		// no any vue file version change, it mean project version was update by ts file change at this time
		if (!virtualFilesUpdatedNum) {
			shouldUpdateTsProject = true;
		}

		// add
		for (const fileName of [...remainRootFiles]) {
			const snapshot = host.getScriptSnapshot(fileName);
			if (snapshot) {
				const virtualFile = virtualFiles.update(fileName, snapshot);
				if (virtualFile) {
					remainRootFiles.delete(fileName);
				}
			}
		}

		// .ts / .js / .d.ts / .json ...
		for (const [oldTsFileName, oldTsFileVersion] of [...sourceTsFileVersions]) {
			const newVersion = host.getScriptVersion(oldTsFileName);
			if (oldTsFileVersion !== newVersion) {
				if (!remainRootFiles.has(oldTsFileName) && !host.getScriptSnapshot(oldTsFileName)) {
					// delete
					sourceTsFileVersions.delete(oldTsFileName);
				}
				else {
					// update
					sourceTsFileVersions.set(oldTsFileName, newVersion);
				}
				shouldUpdateTsProject = true;
			}
		}

		for (const nowFileName of remainRootFiles) {
			if (!sourceTsFileVersions.has(nowFileName)) {
				// add
				const newVersion = host.getScriptVersion(nowFileName);
				sourceTsFileVersions.set(nowFileName, newVersion);
				shouldUpdateTsProject = true;
			}
		}

		for (const [_1, _2, virtualFile] of virtualFiles.all()) {
			if (!shouldUpdateTsProject) {
				forEachEmbeddeds(virtualFile, embedded => {
					if (embedded.kind === EmbeddedFileKind.TypeScriptHostFile) {
						if (virtualFileVersions.has(embedded.fileName) && virtualFileVersions.get(embedded.fileName)?.virtualFileSnapshot !== embedded.snapshot) {
							shouldUpdateTsProject = true;
						}
					}
				});
			}
		}

		if (shouldUpdateTsProject) {
			tsProjectVersion++;
		}
	}
	function getScriptFileNames() {

		const tsFileNames = new Set<string>();

		for (const [_1, _2, sourceFile] of virtualFiles.all()) {
			forEachEmbeddeds(sourceFile, embedded => {
				if (embedded.kind === EmbeddedFileKind.TypeScriptHostFile) {
					tsFileNames.add(embedded.fileName); // virtual .ts
				}
			});
		}

		for (const fileName of host.getScriptFileNames()) {
			if (!virtualFiles.hasSourceFile(fileName)) {
				tsFileNames.add(fileName); // .ts
			}
		}

		return [...tsFileNames];
	}
	function getScriptVersion(fileName: string) {
		let source = virtualFiles.getSourceByVirtualFileName(fileName);
		if (source) {
			let version = virtualFileVersions.get(source[2].fileName);
			if (!version) {
				version = {
					value: 0,
					virtualFileSnapshot: source[2].snapshot,
					sourceFileSnapshot: source[1],
				};
				virtualFileVersions.set(source[2].fileName, version);
			}
			else if (
				version.virtualFileSnapshot !== source[2].snapshot
				|| (host.isTsc && version.sourceFileSnapshot !== source[1]) // fix https://github.com/johnsoncodehk/volar/issues/1082
			) {
				version.value++;
				version.virtualFileSnapshot = source[2].snapshot;
				version.sourceFileSnapshot = source[1];
			}
			return version.value.toString();
		}
		return host.getScriptVersion(fileName);
	}
	function getScriptSnapshot(fileName: string) {
		const version = getScriptVersion(fileName);
		const cache = scriptSnapshots.get(fileName.toLowerCase());
		if (cache && cache[0] === version) {
			return cache[1];
		}
		const source = virtualFiles.getSourceByVirtualFileName(fileName);
		if (source) {
			const snapshot = source[2].snapshot;
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
