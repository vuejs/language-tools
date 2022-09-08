import { posix as path } from 'path';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { EmbeddedLangaugeSourceFile, EmbeddedLanguageModule, LanguageServiceHost } from './types';
import { EmbeddedFile } from './types';
import { createDocumentRegistry, forEachEmbeddeds } from './documentRegistry';

export type LanguageContext = ReturnType<typeof createLanguageContext>;

export function createLanguageContext<T extends EmbeddedLangaugeSourceFile>(
	host: LanguageServiceHost,
	languageModules: EmbeddedLanguageModule[],
	documentRegistry: ReturnType<typeof createDocumentRegistry>,
) {

	let lastProjectVersion: string | undefined;
	let tsProjectVersion = 0;

	const ts = host.getTypeScriptModule();
	const tsFileVersions = new Map<string, string>();
	const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
	const fileVersions = new WeakMap<EmbeddedFile, string>();
	const embeddedLanguageSourceFileVersions = new WeakMap<EmbeddedLangaugeSourceFile, string>();
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
			get: (target, property: keyof typeof documentRegistry) => {
				update();
				return target[property];
			},
		}),
	};

	function update() {

		const newProjectVersion = host.getProjectVersion?.();
		const sholdUpdate = newProjectVersion === undefined || newProjectVersion !== lastProjectVersion;

		if (!sholdUpdate)
			return;

		lastProjectVersion = newProjectVersion;

		const renameFileNames = new Set(host.getScriptFileNames());
		const sourceFilesToUpdate: [EmbeddedLangaugeSourceFile, EmbeddedLanguageModule, ts.IScriptSnapshot][] = [];
		let tsFileUpdated = false;

		// .vue
		for (const [sourceFile, languageModule] of documentRegistry.getAll()) {
			renameFileNames.delete(sourceFile.fileName);
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
		for (const fileName of [...renameFileNames]) {
			const snapshot = host.getScriptSnapshot(fileName);
			if (snapshot) {
				for (const languageModule of languageModules) {
					const sourceFile = languageModule.createSourceFile(fileName, snapshot);
					if (sourceFile) {
						documentRegistry.set(fileName, sourceFile, languageModule);
						renameFileNames.delete(fileName);
						break;
					}
				}
			}
		}

		// .ts / .js / .d.ts / .json ...
		for (const [oldTsFileName, oldTsFileVersion] of [...tsFileVersions]) {
			const newVersion = host.getScriptVersion(oldTsFileName);
			if (oldTsFileVersion !== newVersion) {
				if (!renameFileNames.has(oldTsFileName) && !host.getScriptSnapshot(oldTsFileName)) {
					// delete
					tsFileVersions.delete(oldTsFileName);
				}
				else {
					// update
					tsFileVersions.set(oldTsFileName, newVersion);
				}
				tsFileUpdated = true;
			}
		}

		for (const nowFileName of renameFileNames) {
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
				forEachEmbeddeds(sourceFile.embeddeds, embedded => {
					if (embedded.file.isTsHostFile) {
						oldScripts[embedded.file.fileName] = embedded.file.codeGen.getText();
					}
				});
			}

			languageModule.updateSourceFile(sourceFile, snapshot);

			if (!tsFileUpdated) {
				forEachEmbeddeds(sourceFile.embeddeds, embedded => {
					if (embedded.file.isTsHostFile) {
						newScripts[embedded.file.fileName] = embedded.file.codeGen.getText();
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
			if (mapped.embedded.file.isTsHostFile) {
				tsFileNames.push(mapped.embedded.file.fileName); // virtual .ts
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
			if (fileVersions.has(mapped.embedded.file)) {
				return fileVersions.get(mapped.embedded.file)!;
			}
			else {
				let version = ts.sys?.createHash?.(mapped.embedded.file.codeGen.getText()) ?? mapped.embedded.file.codeGen.getText();
				if (host.isTsc) {
					// fix https://github.com/johnsoncodehk/volar/issues/1082
					version = host.getScriptVersion(mapped.vueFile.fileName) + ':' + version;
				}
				fileVersions.set(mapped.embedded.file, version);
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
			const text = mapped.embedded.file.codeGen.getText();
			const snapshot = ts.ScriptSnapshot.fromString(text);
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
