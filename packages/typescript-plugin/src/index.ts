import { decorateLanguageService, decorateLanguageServiceHost, searchExternalFiles } from '@volar/typescript';
import * as vue from '@vue/language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';

const externalFiles = new WeakMap<ts.server.Project, string[]>();
const projectVueOptions = new WeakMap<ts.server.Project, vue.VueCompilerOptions>();
const windowsPathReg = /\\/g;

const init: ts.server.PluginModuleFactory = (modules) => {
	const { typescript: ts } = modules;
	const pluginModule: ts.server.PluginModule = {
		create(info) {

			const getScriptSnapshot = info.languageServiceHost.getScriptSnapshot.bind(info.languageServiceHost);
			const vueOptions = vue.resolveVueCompilerOptions(getVueCompilerOptions());
			const files = vue.createFileProvider(
				vue.createLanguages(
					ts,
					info.languageServiceHost.getCompilationSettings(),
					vueOptions,
				),
				ts.sys.useCaseSensitiveFileNames,
				fileName => {
					const snapshot = getScriptSnapshot(fileName);
					if (snapshot) {
						files.updateSourceFile(fileName, snapshot, vue.resolveCommonLanguageId(fileName));
					}
					else {
						files.deleteSourceFile(fileName);
					}
				}
			);
			projectVueOptions.set(info.project, vueOptions);

			decorateLanguageService(files, info.languageService, true);
			decorateLanguageServiceHost(files, info.languageServiceHost, ts, vueOptions.extensions);

			const getCompletionsAtPosition = info.languageService.getCompletionsAtPosition;

			info.languageService.getCompletionsAtPosition = (fileName, position, options) => {
				const result = getCompletionsAtPosition(fileName, position, options);
				if (result) {
					result.entries = result.entries.filter(entry => entry.name.indexOf('__VLS_') === -1);
				}
				return result;
			};

			return info.languageService;

			function getVueCompilerOptions() {
				if (info.project.projectKind === ts.server.ProjectKind.Configured) {
					const tsconfig = info.project.getProjectName();
					return vue.createParsedCommandLine(ts, ts.sys, tsconfig.replace(windowsPathReg, '/')).vueOptions;
				}
				else {
					return vue.createParsedCommandLineByJson(ts, ts.sys, info.languageServiceHost.getCurrentDirectory(), {}).vueOptions;
				}
			}
		},
		getExternalFiles(project, updateLevel = 0) {
			if (
				updateLevel >= (1 satisfies ts.ProgramUpdateLevel.RootNamesAndUpdate)
				|| !externalFiles.has(project)
			) {
				const oldFiles = externalFiles.get(project);
				const newFiles = searchExternalFiles(ts, project, projectVueOptions.get(project)!.extensions);
				externalFiles.set(project, newFiles);
				if (oldFiles && !arrayItemsEqual(oldFiles, newFiles)) {
					project.refreshDiagnostics();
				}
			}
			return externalFiles.get(project)!;
		},
	};
	return pluginModule;
};

function arrayItemsEqual(a: string[], b: string[]) {
	if (a.length !== b.length) {
		return false;
	}
	const set = new Set(a);
	for (const file of b) {
		if (!set.has(file)) {
			return false;
		}
	}
	return true;
}

export = init;
