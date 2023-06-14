import type { Language } from '@volar/language-core';
import { posix as path } from 'path';
import { getDefaultVueLanguagePlugins } from './plugins';
import { VueFile } from './sourceFile';
import { VueCompilerOptions } from './types';
import * as sharedTypes from './utils/directorySharedTypes';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { resolveVueCompilerOptions } from './utils/ts';

export function createLanguage(
	compilerOptions: ts.CompilerOptions = {},
	_vueCompilerOptions: Partial<VueCompilerOptions> = {},
	ts: typeof import('typescript/lib/tsserverlibrary') = require('typescript'),
	codegenStack: boolean = false,
) {

	const vueCompilerOptions = resolveVueCompilerOptions(_vueCompilerOptions);

	patchResolveModuleNames(ts, vueCompilerOptions);

	const vueLanguagePlugin = getDefaultVueLanguagePlugins(
		ts,
		compilerOptions,
		vueCompilerOptions,
		codegenStack,
	);
	const languageModule: Language<VueFile> = {
		createVirtualFile(fileName, snapshot, languageId) {
			if (
				languageId === 'vue'
				|| (
					!languageId
					&& vueCompilerOptions.extensions.some(ext => fileName.endsWith(ext))
				)
			) {
				return new VueFile(fileName, snapshot, vueCompilerOptions, vueLanguagePlugin, ts, codegenStack);
			}
		},
		updateVirtualFile(sourceFile, snapshot) {
			sourceFile.update(snapshot);
		},
		resolveHost(host) {
			const sharedTypesSnapshot = ts.ScriptSnapshot.fromString(sharedTypes.getTypesCode(vueCompilerOptions));
			const sharedTypesFileName = path.join(host.getCurrentDirectory(), sharedTypes.baseName);
			return {
				...host,
				getScriptFileNames() {
					return [
						sharedTypesFileName,
						...host.getScriptFileNames(),
					];
				},
				getScriptSnapshot(fileName) {
					if (fileName === sharedTypesFileName) {
						return sharedTypesSnapshot;
					}
					return host.getScriptSnapshot(fileName);
				},
			};
		},
	};

	return languageModule;
}

export function createLanguages(
	compilerOptions: ts.CompilerOptions = {},
	vueCompilerOptions: Partial<VueCompilerOptions> = {},
	ts: typeof import('typescript/lib/tsserverlibrary') = require('typescript'),
	codegenStack: boolean = false,
): Language[] {
	return [
		createLanguage(compilerOptions, vueCompilerOptions, ts, codegenStack),
		...vueCompilerOptions.experimentalAdditionalLanguageModules?.map(module => require(module)) ?? [],
	];
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
