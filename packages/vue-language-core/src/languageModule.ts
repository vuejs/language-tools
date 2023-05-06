import type { Language } from '@volar/language-core';
import { posix as path } from 'path';
import { getDefaultVueLanguagePlugins } from './plugins';
import { VueFile } from './sourceFile';
import { VueCompilerOptions } from './types';
import * as sharedTypes from './utils/directorySharedTypes';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { resolveVueCompilerOptions } from './utils/ts';

export function createLanguages(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions = resolveVueCompilerOptions({}),
): Language[] {

	patchResolveModuleNames(ts, vueCompilerOptions);

	const vueLanguagePlugin = getDefaultVueLanguagePlugins(
		ts,
		compilerOptions,
		vueCompilerOptions,
	);
	const sharedTypesSnapshot = ts.ScriptSnapshot.fromString(sharedTypes.getTypesCode(vueCompilerOptions));
	const languageModule: Language = {
		createVirtualFile(fileName, snapshot, languageId) {
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
		updateVirtualFile(sourceFile: VueFile, snapshot) {
			sourceFile.update(snapshot);
		},
		resolveHost(host) {
			return {
				...host,
				fileExists(fileName) {
					const basename = path.basename(fileName);
					if (basename === sharedTypes.baseName) {
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
					if (basename === sharedTypes.baseName) {
						return '';
					}
					return host.getScriptVersion(fileName);
				},
				getScriptSnapshot(fileName) {
					const basename = path.basename(fileName);
					if (basename === sharedTypes.baseName) {
						return sharedTypesSnapshot;
					}
					return host.getScriptSnapshot(fileName);
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
		return moduleFileDirs.map(dir => path.join(dir, sharedTypes.baseName));
	}
}

function patchResolveModuleNames(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	vueCompilerOptions: VueCompilerOptions,
) {
	try {
		// from https://github.com/vuejs/language-tools/pull/1543
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
