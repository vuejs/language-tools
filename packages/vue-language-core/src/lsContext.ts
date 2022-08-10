import { posix as path } from 'path';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { LanguageServiceHost, VueCompilerOptions } from './types';
import * as localTypes from './utils/localTypes';
import { createSourceFile, EmbeddedFile, VueLanguagePlugin } from './sourceFile';
import { createDocumentRegistry } from './documentRegistry';

import * as useHtmlFilePlugin from './plugins/file-html';
import * as  useMdFilePlugin from './plugins/file-md';
import * as  useVueFilePlugin from './plugins/file-vue';
import * as  useVueSfcCustomBlocks from './plugins/vue-sfc-customblocks';
import * as  useVueSfcScriptsFormat from './plugins/vue-sfc-scripts';
import * as  useVueSfcStyles from './plugins/vue-sfc-styles';
import * as  useVueSfcTemplate from './plugins/vue-sfc-template';
import * as  useHtmlPlugin from './plugins/vue-template-html';
import * as  usePugPlugin from './plugins/vue-template-pug';
import useVueTsx from './plugins/vue-tsx';
import { getVueCompilerOptions } from './utils/ts';

export type LanguageContext = ReturnType<typeof createLanguageContext>;

export function getPlugins(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	rootDir: string,
	compilerOptions: ts.CompilerOptions,
	_vueCompilerOptions: VueCompilerOptions,
	extraPlugins: VueLanguagePlugin[] = [],
) {

	const _plugins: VueLanguagePlugin[] = [
		useVueFilePlugin,
		useMdFilePlugin,
		useHtmlFilePlugin,
		useHtmlPlugin,
		usePugPlugin,
		useVueSfcStyles,
		useVueSfcCustomBlocks,
		useVueSfcScriptsFormat,
		useVueSfcTemplate,
		useVueTsx,
		...extraPlugins,
	];
	const vueCompilerOptions = getVueCompilerOptions(_vueCompilerOptions);
	for (const pluginPath of vueCompilerOptions.plugins) {
		try {
			const importPath = require.resolve(pluginPath, { paths: [rootDir] });
			const plugin = require(importPath);
			_plugins.push(plugin);
		}
		catch (error) {
			console.error(error);
		}
	}
	const pluginCtx: Parameters<VueLanguagePlugin>[0] = {
		modules: {
			typescript: ts,
		},
		compilerOptions,
		vueCompilerOptions: vueCompilerOptions,
	};
	const plugins = _plugins.map(plugin => plugin(pluginCtx));

	return plugins;
}

export function createLanguageContext(
	host: LanguageServiceHost,
	extraPlugins: VueLanguagePlugin[] = [],
	exts = ['.vue', '.md', '.html'],
) {

	let lastProjectVersion: string | undefined;
	let tsProjectVersion = 0;

	const ts = host.getTypeScriptModule();

	// from https://github.com/johnsoncodehk/volar/pull/1543
	if (!((ts as any).__VLS_pitched_resolveModuleNames)) {
		(ts as any).__VLS_pitched_resolveModuleNames = true;
		const resolveModuleNames = ts.resolveModuleName;
		ts.resolveModuleName = (...args) => {
			if (args[0].endsWith('.vue') && args[6] === ts.ModuleKind.ESNext) {
				args[6] = ts.ModuleKind.CommonJS;
			}
			return resolveModuleNames(...args);
		};
	}

	const documentRegistry = createDocumentRegistry();
	const compilerOptions = host.getCompilationSettings();
	const vueCompilerOptions = getVueCompilerOptions(host.getVueCompilationSettings());
	const tsFileVersions = new Map<string, string>();
	const sharedTypesScript = ts.ScriptSnapshot.fromString(localTypes.getTypesCode(vueCompilerOptions.target));
	const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
	const fileVersions = new WeakMap<EmbeddedFile, string>();
	const _tsHost: Partial<ts.LanguageServiceHost> = {
		fileExists: host.fileExists
			? fileName => {

				const basename = path.basename(fileName);
				if (basename === localTypes.typesFileName) {
					return true;
				}

				// .vue.js -> .vue
				// .vue.ts -> .vue
				// .vue.d.ts (never)
				const vueFileName = fileName.substring(0, fileName.lastIndexOf('.'));

				if (exts.some(ext => vueFileName.endsWith(ext))) {
					const vueFile = documentRegistry.get(vueFileName);
					if (!vueFile) {
						const fileExists = !!host.fileExists?.(vueFileName);
						if (fileExists) {
							// create virtual files
							const scriptSnapshot = host.getScriptSnapshot(vueFileName);
							if (scriptSnapshot) {
								documentRegistry.set(vueFileName, createSourceFile(
									vueFileName,
									scriptSnapshot.getText(0, scriptSnapshot.getLength()),
									vueCompilerOptions,
									ts,
									plugins,
								));
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

			if (exts.some(ext => fileName.endsWith(ext)))
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
	const plugins = getPlugins(ts, host.getCurrentDirectory(), compilerOptions, vueCompilerOptions, extraPlugins);

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
		plugins,
	};

	function update() {

		const newProjectVersion = host.getProjectVersion?.();
		const sholdUpdate = newProjectVersion === undefined || newProjectVersion !== lastProjectVersion;

		if (!sholdUpdate)
			return;

		lastProjectVersion = newProjectVersion;

		const fileNames = host.getScriptFileNames();
		const vueFileNames = new Set(fileNames.filter(file => exts.some(ext => file.endsWith(ext))));
		const tsFileNames = new Set(fileNames.filter(file => !exts.some(ext => file.endsWith(ext))));
		const fileNamesToRemove: string[] = [];
		const fileNamesToCreate: string[] = [];
		const fileNamesToUpdate: string[] = [];
		let tsFileUpdated = false;

		// .vue
		for (const vueFile of documentRegistry.getAll()) {
			const newSnapshot = host.getScriptSnapshot(vueFile.fileName);
			if (!newSnapshot) {
				// delete
				fileNamesToRemove.push(vueFile.fileName);
			}
			else {
				// update
				if (vueFile.text !== newSnapshot.getText(0, newSnapshot.getLength())) {
					fileNamesToUpdate.push(vueFile.fileName);
				}
			}
		}

		for (const nowFileName of vueFileNames) {
			if (!documentRegistry.get(nowFileName)) {
				// add
				fileNamesToCreate.push(nowFileName);
			}
		}

		// .ts / .js / .d.ts / .json ...
		for (const tsFileVersion of tsFileVersions) {
			if (!tsFileNames.has(tsFileVersion[0]) && !host.getScriptSnapshot(tsFileVersion[0])) {
				// delete
				tsFileVersions.delete(tsFileVersion[0]);
				tsFileUpdated = true;
			}
			else {
				// update
				const newVersion = host.getScriptVersion(tsFileVersion[0]);
				if (tsFileVersion[1] !== newVersion) {
					tsFileVersions.set(tsFileVersion[0], newVersion);
					tsFileUpdated = true;
				}
			}
		}

		for (const nowFileName of tsFileNames) {
			if (!tsFileVersions.has(nowFileName)) {
				// add
				const newVersion = host.getScriptVersion(nowFileName);
				tsFileVersions.set(nowFileName, newVersion);
				tsFileUpdated = true;
			}
		}

		for (const uri of fileNamesToRemove) {
			if (documentRegistry.delete(uri)) {
				tsFileUpdated = true;
			}
		}

		for (const fileName of [
			...fileNamesToCreate,
			...fileNamesToUpdate,
		]) {

			const scriptSnapshot = host.getScriptSnapshot(fileName);
			if (!scriptSnapshot) {
				continue;
			}

			const sourceFile = documentRegistry.get(fileName);
			const scriptText = scriptSnapshot.getText(0, scriptSnapshot.getLength());

			if (!sourceFile) {
				documentRegistry.set(fileName, createSourceFile(
					fileName,
					scriptText,
					vueCompilerOptions,
					ts,
					plugins,
				));
				tsFileUpdated = true;
			}
			else {

				const oldScripts: Record<string, string> = {};
				const newScripts: Record<string, string> = {};

				if (!tsFileUpdated) {
					for (const embedded of sourceFile.allEmbeddeds) {
						if (embedded.file.isTsHostFile) {
							oldScripts[embedded.file.fileName] = embedded.file.codeGen.getText();
						}
					}
				}

				sourceFile.text = scriptText;

				if (!tsFileUpdated) {
					for (const embedded of sourceFile.allEmbeddeds) {
						if (embedded.file.isTsHostFile) {
							newScripts[embedded.file.fileName] = embedded.file.codeGen.getText();
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
	function getScriptFileNames() {

		const tsFileNames = documentRegistry.getDirs().map(dir => path.join(dir, localTypes.typesFileName));

		for (const mapped of documentRegistry.getAllEmbeddeds()) {
			if (mapped.embedded.file.isTsHostFile) {
				tsFileNames.push(mapped.embedded.file.fileName); // virtual .ts
			}
		}

		for (const fileName of host.getScriptFileNames()) {
			if (host.isTsPlugin) {
				tsFileNames.push(fileName); // .vue + .ts
			}
			else if (!exts.some(ext => fileName.endsWith(ext))) {
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
		let mapped = documentRegistry.fromEmbeddedFileName(fileName);
		if (mapped) {
			if (fileVersions.has(mapped.embedded.file)) {
				return fileVersions.get(mapped.embedded.file)!;
			}
			else {
				let version = ts.sys.createHash?.(mapped.embedded.file.codeGen.getText()) ?? mapped.embedded.file.codeGen.getText();
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
		const basename = path.basename(fileName);
		if (basename === localTypes.typesFileName) {
			return sharedTypesScript;
		}
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
			if (!(vueCompilerOptions.strictTemplates ?? false) && (
				// for vue 2.6 and vue 3
				basename === 'runtime-dom.d.ts' ||
				// for vue 2.7
				basename === 'jsx.d.ts'
			)) {
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
