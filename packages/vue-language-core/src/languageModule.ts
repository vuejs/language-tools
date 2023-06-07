import type { Language, LanguageServiceHost } from '@volar/language-core';
import { posix as path } from 'path';
import { getDefaultVueLanguagePlugins } from './plugins';
import { VueFile } from './sourceFile';
import { VueCompilerOptions } from './types';
import * as sharedTypes from './utils/directorySharedTypes';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { resolveVueCompilerOptions } from './utils/ts';

// tried to do something similar to
// vue compiler-sfc
// https://github.com/vuejs/core/blob/bdf3492aee2a970ab7e73cf833d729679c731111/packages/compiler-sfc/src/script/resolveType.ts#L845
// below utils copied from compiler-sfc util script, can it be shared?
// https://github.com/vuejs/core/blob/bdf3492aee2a970ab7e73cf833d729679c731111/packages/compiler-sfc/src/script/utils.ts#LL83C1-L100C2
const identity = (str: string) => str;
const fileNameLowerCaseRegExp = /[^\u0130\u0131\u00DFa-z0-9\\/:\-_\. ]+/g;
const toLowerCase = (str: string) => str.toLowerCase();

function toFileNameLowerCase(x: string) {
	return fileNameLowerCaseRegExp.test(x)
		? x.replace(fileNameLowerCaseRegExp, toLowerCase)
		: x;
}

export function createGetCanonicalFileName(useCaseSensitiveFileNames: boolean) {
	return useCaseSensitiveFileNames ? identity : toFileNameLowerCase;
}
let moduleCache: ts.ModuleResolutionCache | null = null;
function getModuleResolutionCache(
	ts: typeof import("typescript/lib/tsserverlibrary"),
	options: ts.CompilerOptions,
	host: LanguageServiceHost
) {
	if (moduleCache === null) {
		moduleCache = ts.createModuleResolutionCache(
			host.getCurrentDirectory(),
			createGetCanonicalFileName(ts.sys.useCaseSensitiveFileNames),
			options
		);
	}
	return moduleCache;
}

export function createLanguage(
	compilerOptions: ts.CompilerOptions = {},
	vueCompilerOptions = resolveVueCompilerOptions({}),
	ts: typeof import('typescript/lib/tsserverlibrary') = require('typescript'),
	codegenStack: boolean = false,
): Language {

	patchResolveModuleNames(ts, vueCompilerOptions);

	const vueLanguagePlugin = getDefaultVueLanguagePlugins(
		ts,
		compilerOptions,
		vueCompilerOptions,
		codegenStack,
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
				return new VueFile(fileName, snapshot, ts, vueLanguagePlugin, codegenStack);
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
				resolveModuleNameLiterals(
					moduleLiterals,
					containingFile,
					redirectedReference,
					options,
					sourceFile
				) {
					return moduleLiterals.map((moduleLiteral) => {
						let moduleName = moduleLiteral.text;
						if (sourceFile.impliedNodeFormat === ts.ModuleKind.ESNext && vueCompilerOptions.extensions.some(ext => moduleName.endsWith(ext))) {
							moduleName = `${moduleName}.js`;
						}
						return ts.resolveModuleName(
							moduleName,
							containingFile,
							options,
							this,
							getModuleResolutionCache(ts, options, this),
							redirectedReference,
							sourceFile.impliedNodeFormat
						)
					});
				}
			};
		},
	};

	return languageModule;

	function getSharedTypesFiles(fileNames: string[]) {
		const moduleFiles = fileNames.filter(fileName => vueCompilerOptions.extensions.some(ext => fileName.endsWith(ext)));
		const moduleFileDirs = [...new Set(moduleFiles.map(path.dirname))];
		return moduleFileDirs.map(dir => path.join(dir, sharedTypes.baseName));
	}
}

export function createLanguages(
	compilerOptions: ts.CompilerOptions = {},
	vueCompilerOptions = resolveVueCompilerOptions({}),
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
