import * as path from 'path';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { LanguageServiceHost } from './types';
import * as localTypes from './utils/localTypes';
import { createVueFile, EmbeddedFile } from './vueFile';
import { createVueFiles } from './vueFiles';

export type TypeScriptRuntime = ReturnType<typeof createTypeScriptRuntime>;

export function createTypeScriptRuntime(options: {
	typescript: typeof import('typescript/lib/tsserverlibrary'),
	vueLsHost: LanguageServiceHost,
	isTsPlugin?: boolean,
	isVueTsc?: boolean,
}) {

	let lastProjectVersion: string | undefined;
	let tsProjectVersion = 0;

	const { typescript: ts } = options;
	const vueCompilerOptions = options.vueLsHost.getVueCompilationSettings();
	const tsFileVersions = new Map<string, string>();
	const vueFiles = withUpdate(createVueFiles());
	const tsLsHost = withUpdate(createTsLsHost());
	const tsLs = ts.createLanguageService(tsLsHost);
	const localTypesScript = ts.ScriptSnapshot.fromString(localTypes.getTypesCode(vueCompilerOptions.target ?? 3));

	return {
		vueFiles,
		getTsLs: () => tsLs,
		getTsLsHost: () => tsLsHost,
		dispose: () => {
			tsLs.dispose();
		},
		getLocalTypesFiles: () => {
			const fileNames = getLocalTypesFiles();
			const code = localTypes.getTypesCode(vueCompilerOptions.target ?? 3);
			return {
				fileNames,
				code,
			};
		},
	};

	function withUpdate<T extends object>(t: T): T {
		return new Proxy(t, {
			get(target, property) {
				update();
				return target[property as keyof T];
			}
		});
	}
	function getLocalTypesFiles() {
		return vueFiles.getDirs().map(dir => path.join(dir, localTypes.typesFileName));
	}
	function update() {

		const newProjectVersion = options.vueLsHost.getProjectVersion?.();
		const sholdUpdate = newProjectVersion === undefined || newProjectVersion !== lastProjectVersion;

		if (!sholdUpdate)
			return;

		lastProjectVersion = newProjectVersion;

		const fileNames = options.vueLsHost.getScriptFileNames();
		const vueFileNames = new Set(fileNames.filter(file => file.endsWith('.vue') || file.endsWith('.md')));
		const tsFileNames = new Set(fileNames.filter(file => !file.endsWith('.vue') && !file.endsWith('.md')));
		const fileNamesToRemove: string[] = [];
		const fileNamesToCreate: string[] = [];
		const fileNamesToUpdate: string[] = [];
		let tsFileUpdated = false;

		// .vue
		for (const vueFile of vueFiles.getAll()) {
			if (!vueFileNames.has(vueFile.fileName) && !options.vueLsHost.fileExists?.(vueFile.fileName)) {
				// delete
				fileNamesToRemove.push(vueFile.fileName);
			}
			else {
				// update
				const newSnapshot = options.vueLsHost.getScriptSnapshot(vueFile.fileName);
				if (vueFile.text !== newSnapshot?.getText(0, newSnapshot.getLength())) {
					fileNamesToUpdate.push(vueFile.fileName);
				}
			}
		}

		for (const nowFileName of vueFileNames) {
			if (!vueFiles.get(nowFileName)) {
				// add
				fileNamesToCreate.push(nowFileName);
			}
		}

		// .ts / .js / .d.ts / .json ...
		for (const tsFileVersion of tsFileVersions) {
			if (!vueFileNames.has(tsFileVersion[0]) && !options.vueLsHost.fileExists?.(tsFileVersion[0])) {
				// delete
				tsFileVersions.delete(tsFileVersion[0]);
				tsFileUpdated = true;
			}
			else {
				// update
				const newVersion = options.vueLsHost.getScriptVersion(tsFileVersion[0]);
				if (tsFileVersion[1] !== newVersion) {
					tsFileVersions.set(tsFileVersion[0], newVersion);
					tsFileUpdated = true;
				}
			}
		}

		for (const nowFileName of tsFileNames) {
			if (!tsFileVersions.has(nowFileName)) {
				// add
				const newVersion = options.vueLsHost.getScriptVersion(nowFileName);
				tsFileVersions.set(nowFileName, newVersion);
				tsFileUpdated = true;
			}
		}

		for (const uri of fileNamesToRemove) {
			if (vueFiles.delete(uri)) {
				tsFileUpdated = true;
			}
		}

		for (const fileName of [
			...fileNamesToCreate,
			...fileNamesToUpdate,
		]) {

			const scriptSnapshot = options.vueLsHost.getScriptSnapshot(fileName);
			if (!scriptSnapshot) {
				continue;
			}

			const sourceFile = vueFiles.get(fileName);
			const scriptText = scriptSnapshot.getText(0, scriptSnapshot.getLength());

			if (!sourceFile) {
				vueFiles.set(fileName, createVueFile(
					fileName,
					scriptText,
					options.vueLsHost.getVueCompilationSettings(),
					options.typescript,
					() => tsLs,
					tsLsHost,
				));
				tsFileUpdated = true;
			}
			else {

				const oldScripts: Record<string, string> = {};
				const newScripts: Record<string, string> = {};

				if (!tsFileUpdated) {
					for (const embedded of sourceFile.getAllEmbeddeds()) {
						if (embedded.file.isTsHostFile) {
							oldScripts[embedded.file.fileName] = embedded.file.content;
						}
					}
				}

				sourceFile.text = scriptText;

				if (!tsFileUpdated) {
					for (const embedded of sourceFile.getAllEmbeddeds()) {
						if (embedded.file.isTsHostFile) {
							newScripts[embedded.file.fileName] = embedded.file.content;
						}
					}
				}

				if (
					Object.keys(oldScripts).length !== Object.keys(newScripts).length
					|| Object.keys(oldScripts).some(fileName => oldScripts[fileName] !== newScripts[fileName])
				) {
					tsFileUpdated = true;
				}
			}
		}

		if (tsFileUpdated) {
			tsProjectVersion++;
		}
	}
	function createTsLsHost() {

		const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
		const fileVersions = new WeakMap<EmbeddedFile, string>();
		const _tsHost: Partial<ts.LanguageServiceHost> = {
			fileExists: options.vueLsHost.fileExists
				? fileName => {
					// .vue.js -> .vue
					// .vue.ts -> .vue
					// .vue.d.ts (never)
					const fileNameTrim = fileName.substring(0, fileName.lastIndexOf('.'));

					if (fileNameTrim.endsWith('.vue') || fileNameTrim.endsWith('.md')) {
						const vueFile = vueFiles.get(fileNameTrim);
						if (!vueFile) {
							const fileExists = !!options.vueLsHost.fileExists?.(fileNameTrim);
							if (fileExists) {
								// create virtual files
								const scriptSnapshot = options.vueLsHost.getScriptSnapshot(fileName);
								if (scriptSnapshot) {
									vueFiles.set(fileName, createVueFile(
										fileName,
										scriptSnapshot.getText(0, scriptSnapshot.getLength()),
										options.vueLsHost.getVueCompilationSettings(),
										options.typescript,
										() => tsLs,
										tsLsHost,
									));
								}
							}
						}
					}

					if (!!vueFiles.fromEmbeddedFileName(fileName)) {
						return true;
					}

					return !!options.vueLsHost.fileExists?.(fileName);
				}
				: undefined,
			getProjectVersion: () => {
				return tsProjectVersion.toString();
			},
			getScriptFileNames,
			getScriptVersion,
			getScriptSnapshot,
			readDirectory: (_path, extensions, exclude, include, depth) => {
				const result = options.vueLsHost.readDirectory?.(_path, extensions, exclude, include, depth) ?? [];
				for (const vuePath of vueFiles.getFileNames()) {
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
				switch (path.extname(fileName)) {
					case '.vue': return ts.ScriptKind.TSX; // can't use External, Unknown
					case '.md': return ts.ScriptKind.TSX; // can't use External, Unknown
					case '.js': return ts.ScriptKind.JS;
					case '.jsx': return ts.ScriptKind.JSX;
					case '.ts': return ts.ScriptKind.TS;
					case '.tsx': return ts.ScriptKind.TSX;
					case '.json': return ts.ScriptKind.JSON;
					default: return ts.ScriptKind.Unknown;
				}
			},
		};

		const tsHost = new Proxy<ts.LanguageServiceHost>(_tsHost as ts.LanguageServiceHost, {
			get: (target, property: keyof ts.LanguageServiceHost) => {
				return target[property] || options.vueLsHost[property];
			},
		});

		return tsHost;

		function getScriptFileNames() {

			const tsFileNames = getLocalTypesFiles();

			for (const mapped of vueFiles.getAllEmbeddeds()) {
				if (mapped.embedded.file.isTsHostFile) {
					tsFileNames.push(mapped.embedded.file.fileName); // virtual .ts
				}
			}

			for (const fileName of options.vueLsHost.getScriptFileNames()) {
				if (options.isTsPlugin) {
					tsFileNames.push(fileName); // .vue + .ts
				}
				else if (!fileName.endsWith('.vue') && !fileName.endsWith('.md')) {
					tsFileNames.push(fileName); // .ts
				}
			}

			return tsFileNames;
		}
		function getScriptVersion(fileName: string) {
			const basename = path.basename(fileName);
			if (basename === localTypes.typesFileName) {
				return '';
			}
			let mapped = vueFiles.fromEmbeddedFileName(fileName);
			if (mapped) {
				if (fileVersions.has(mapped.embedded.file)) {
					return fileVersions.get(mapped.embedded.file)!;
				}
				else {
					let version = ts.sys.createHash?.(mapped.embedded.file.content) ?? mapped.embedded.file.content;
					if (options.isVueTsc) {
						// fix https://github.com/johnsoncodehk/volar/issues/1082
						version = options.vueLsHost.getScriptVersion(mapped.vueFile.fileName) + ':' + version;
					}
					fileVersions.set(mapped.embedded.file, version);
					return version;
				}
			}
			return options.vueLsHost.getScriptVersion(fileName);
		}
		function getScriptSnapshot(fileName: string) {
			const basename = path.basename(fileName);
			if (basename === localTypes.typesFileName) {
				return localTypesScript;
			}
			const version = getScriptVersion(fileName);
			const cache = scriptSnapshots.get(fileName.toLowerCase());
			if (cache && cache[0] === version) {
				return cache[1];
			}
			const mapped = vueFiles.fromEmbeddedFileName(fileName);
			if (mapped) {
				const text = mapped.embedded.file.content;
				const snapshot = ts.ScriptSnapshot.fromString(text);
				scriptSnapshots.set(fileName.toLowerCase(), [version, snapshot]);
				return snapshot;
			}
			let tsScript = options.vueLsHost.getScriptSnapshot(fileName);
			if (tsScript) {
				if ((vueCompilerOptions.experimentalSuppressUnknownJsxPropertyErrors ?? true) && basename === 'runtime-dom.d.ts') {
					// allow arbitrary attributes
					let tsScriptText = tsScript.getText(0, tsScript.getLength());
					tsScriptText = tsScriptText.replace(
						'type ReservedProps = {',
						'type ReservedProps = { [name: string]: any',
					);
					tsScript = ts.ScriptSnapshot.fromString(tsScriptText);
				}
				scriptSnapshots.set(fileName.toLowerCase(), [version, tsScript]);
				return tsScript;
			}
		}
	}
}
