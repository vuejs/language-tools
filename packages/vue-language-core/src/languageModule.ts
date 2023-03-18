import type * as embedded from '@volar/language-core';
import { posix as path } from 'path';
import { getDefaultVueLanguagePlugins } from './plugins';
import { VueFile } from './sourceFile';
import { VueCompilerOptions } from './types';
import * as localTypes from './utils/localTypes';
import type * as ts from 'typescript/lib/tsserverlibrary';

export function createLanguageModules(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
): embedded.LanguageModule[] {

	const patchSnapshots = new WeakMap<ts.IScriptSnapshot, ts.IScriptSnapshot>();

	patchResolveModuleNames(ts, vueCompilerOptions);

	const vueLanguagePlugin = getDefaultVueLanguagePlugins(
		ts,
		compilerOptions,
		vueCompilerOptions,
	);
	const sharedTypesSnapshot = ts.ScriptSnapshot.fromString(localTypes.getTypesCode(vueCompilerOptions.target, vueCompilerOptions));
	const languageModule: embedded.LanguageModule = {
		createFile(fileName, snapshot, languageId) {
			if (
				languageId === 'vue'
				|| (
					!languageId
					&& vueCompilerOptions.extensions.some(ext => fileName.endsWith(ext))
				)
			) {
				return new VueFile(fileName, snapshot, ts, vueLanguagePlugin);
			}
		},
		updateFile(sourceFile: VueFile, snapshot) {
			sourceFile.update(snapshot);
		},
		proxyLanguageServiceHost(host) {
			return {
				fileExists(fileName) {
					const basename = path.basename(fileName);
					if (basename === localTypes.typesFileName) {
						return true;
					}
					return host.fileExists(fileName);
				},
				getScriptFileNames() {
					const fileNames = host.getScriptFileNames();
					return [
						...getSharedTypesFiles(fileNames),
						...fileNames,
					];
				},
				getScriptVersion(fileName) {
					const basename = path.basename(fileName);
					if (basename === localTypes.typesFileName) {
						return '';
					}
					return host.getScriptVersion(fileName);
				},
				getScriptSnapshot(fileName) {
					const basename = path.basename(fileName);
					if (basename === localTypes.typesFileName) {
						return sharedTypesSnapshot;
					}
					let snapshot = host.getScriptSnapshot(fileName);
					if (snapshot) {
						if (!vueCompilerOptions.strictTemplates && (
							// for vue 2.6 and vue 3
							basename === 'runtime-dom.d.ts' ||
							// for vue 2.7
							basename === 'jsx.d.ts'
						)) {
							if (!patchSnapshots.has(snapshot)) {
								// allow arbitrary attributes
								let tsScriptText = snapshot.getText(0, snapshot.getLength());
								tsScriptText = tsScriptText.replace(
									'type ReservedProps = {',
									'type ReservedProps = { [name: string]: any',
								);
								patchSnapshots.set(snapshot, ts.ScriptSnapshot.fromString(tsScriptText));
							}
							snapshot = patchSnapshots.get(snapshot)!;
						}
					}
					return snapshot;
				},
			};
		},
	};

	return [
		languageModule,
		...vueCompilerOptions.experimentalAdditionalLanguageModules?.map(module => require(module)) ?? [],
	];

	function getSharedTypesFiles(fileNames: string[]) {
		const moduleFiles = fileNames.filter(fileName => vueCompilerOptions.extensions.some(ext => fileName.endsWith(ext)));
		const moduleFileDirs = [...new Set(moduleFiles.map(path.dirname))];
		return moduleFileDirs.map(dir => path.join(dir, localTypes.typesFileName));
	}
}

function patchResolveModuleNames(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	vueCompilerOptions: VueCompilerOptions,
) {
	try {
		// from https://github.com/johnsoncodehk/volar/pull/1543
		if (!((ts as any).__vuePatchResolveModuleNames)) {
			(ts as any).__vuePatchResolveModuleNames = true;
			const resolveModuleNames = ts.resolveModuleName;
			ts.resolveModuleName = (...args) => {
				if (args[6] === ts.ModuleKind.ESNext && vueCompilerOptions.extensions.some(ext => args[0].endsWith(ext))) {
					args[6] = ts.ModuleKind.CommonJS;
				}
				return resolveModuleNames(...args);
			};
		}
	}
	catch (e) {
		// console.warn('[volar] patchResolveModuleNames failed', e);
	}
}
