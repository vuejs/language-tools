import type { Language } from '@volar/language-core';
import { posix as path } from 'path';
import { getDefaultVueLanguagePlugins } from './plugins';
import { VueFile } from './sourceFile';
import { VueCompilerOptions } from './types';
import * as sharedTypes from './utils/globalTypes';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { resolveVueCompilerOptions } from './utils/ts';

export function createLanguage(
	compilerOptions: ts.CompilerOptions = {},
	_vueCompilerOptions: Partial<VueCompilerOptions> = {},
	ts: typeof import('typescript/lib/tsserverlibrary') = require('typescript'),
	codegenStack: boolean = false,
) {

	const vueCompilerOptions = resolveVueCompilerOptions(_vueCompilerOptions);
	const vueLanguagePlugin = getDefaultVueLanguagePlugins(
		ts,
		compilerOptions,
		vueCompilerOptions,
		codegenStack,
	);
	const allowLanguageIds = new Set(['vue']);

	if (vueCompilerOptions.extensions.includes('.md')) {
		allowLanguageIds.add('markdown');
	}
	if (vueCompilerOptions.extensions.includes('.html')) {
		allowLanguageIds.add('html');
	}

	const languageModule: Language<VueFile> = {
		createVirtualFile(fileName, snapshot, languageId) {
			if (
				(languageId && allowLanguageIds.has(languageId))
				|| (!languageId && vueCompilerOptions.extensions.some(ext => fileName.endsWith(ext)))
			) {
				return new VueFile(fileName, snapshot, vueCompilerOptions, vueLanguagePlugin, ts, codegenStack);
			}
		},
		updateVirtualFile(sourceFile, snapshot) {
			sourceFile.update(snapshot);
		},
		resolveHost(host) {
			const sharedTypesSnapshot = ts.ScriptSnapshot.fromString(sharedTypes.getTypesCode(vueCompilerOptions));
			const sharedTypesFileName = path.join(host.rootPath, sharedTypes.baseName);
			return {
				...host,
				resolveModuleName(moduleName, impliedNodeFormat) {
					if (impliedNodeFormat === ts.ModuleKind.ESNext && vueCompilerOptions.extensions.some(ext => moduleName.endsWith(ext))) {
						return `${moduleName}.js`;
					}
					return host.resolveModuleName?.(moduleName, impliedNodeFormat) ?? moduleName;
				},
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
