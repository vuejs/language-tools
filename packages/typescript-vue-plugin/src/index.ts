import * as vue from '@vue/language-core';
import * as vueTs from '@vue/typescript';
import type * as ts from 'typescript/lib/tsserverlibrary';

const init: ts.server.PluginModuleFactory = (modules) => {
	const { typescript: ts } = modules;
	const externalFiles = new Map<ts.server.Project, string[]>();
	const pluginModule: ts.server.PluginModule = {
		create(info) {

			const projectName = info.project.getProjectName();

			if (!info.project.fileExists(projectName)) {
				// project name not a tsconfig path, this is a inferred project
				return info.languageService;
			}

			const extraFileExtensions: ts.FileExtensionInfo[] = [{
				extension: 'vue',
				isMixedContent: true,
				scriptKind: ts.ScriptKind.Deferred,
			}];
			const parsed = vue.createParsedCommandLine(ts, ts.sys, projectName, extraFileExtensions);
			const vueFileNames = parsed.fileNames.filter(fileName => fileName.endsWith('.vue'));
			if (!vueFileNames.length) {
				// no vue file
				return info.languageService;
			}

			externalFiles.set(info.project, vueFileNames);

			// fix: https://github.com/vuejs/language-tools/issues/205
			if (!(info.project as any).__vue_getScriptKind) {
				(info.project as any).__vue_getScriptKind = info.project.getScriptKind;
				info.project.getScriptKind = fileName => {
					if (fileName.endsWith('.vue')) {
						return ts.ScriptKind.Deferred;
					}
					return (info.project as any).__vue_getScriptKind(fileName);
				};
			}

			const vueTsLsHost: vue.VueLanguageServiceHost = {
				getNewLine: () => info.project.getNewLine(),
				useCaseSensitiveFileNames: () => info.project.useCaseSensitiveFileNames(),
				readFile: path => info.project.readFile(path),
				writeFile: (path, content) => info.project.writeFile(path, content),
				fileExists: path => info.project.fileExists(path),
				directoryExists: path => info.project.directoryExists(path),
				getDirectories: path => info.project.getDirectories(path),
				readDirectory: (path, extensions, exclude, include, depth) => info.project.readDirectory(path, extensions, exclude, include, depth),
				realpath: info.project.realpath ? path => info.project.realpath!(path) : undefined,
				getCompilationSettings: () => info.project.getCompilationSettings(),
				getVueCompilationSettings: () => parsed.vueOptions,
				getCurrentDirectory: () => info.project.getCurrentDirectory(),
				getDefaultLibFileName: () => info.project.getDefaultLibFileName(),
				getProjectVersion: () => info.project.getProjectVersion(),
				getProjectReferences: () => info.project.getProjectReferences(),
				getScriptFileNames: () => [
					...info.project.getScriptFileNames(),
					...vueFileNames,
				],
				getScriptVersion: (fileName) => info.project.getScriptVersion(fileName),
				getScriptSnapshot: (fileName) => info.project.getScriptSnapshot(fileName),
			};
			const vueTsLs = vueTs.createLanguageService(vueTsLsHost);

			return new Proxy(info.languageService, {
				get: (target: any, property: keyof ts.LanguageService) => {
					if (
						property === 'getSemanticDiagnostics'
						|| property === 'getEncodedSemanticClassifications'
						|| property === 'getCompletionsAtPosition'
						|| property === 'getCompletionEntryDetails'
						|| property === 'getCompletionEntrySymbol'
						|| property === 'getQuickInfoAtPosition'
						|| property === 'getSignatureHelpItems'
						|| property === 'getRenameInfo'
						|| property === 'findRenameLocations'
						|| property === 'getDefinitionAtPosition'
						|| property === 'getDefinitionAndBoundSpan'
						|| property === 'getTypeDefinitionAtPosition'
						|| property === 'getImplementationAtPosition'
						|| property === 'getReferencesAtPosition'
						|| property === 'findReferences'
					) {
						return vueTsLs[property];
					}
					return target[property];
				},
			});
		},
		getExternalFiles(project) {
			return externalFiles.get(project) ?? [];
		},
	};
	return pluginModule;
};

export = init;
