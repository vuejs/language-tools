import { decorateLanguageService, decorateLanguageServiceHost, searchExternalFiles } from '@volar/typescript';
import * as vue from '@vue/language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';

const externalFiles = new WeakMap<ts.server.Project, string[]>();
const windowsPathReg = /\\/g;

const init: ts.server.PluginModuleFactory = (modules) => {
	const { typescript: ts } = modules;
	const pluginModule: ts.server.PluginModule = {
		create(info) {

			const virtualFiles = vue.createVirtualFiles(
				vue.createLanguages(
					ts,
					info.languageServiceHost.getCompilationSettings(),
					getVueCompilerOptions(),
				),
			);

			decorateLanguageService(virtualFiles, info.languageService, true);
			decorateLanguageServiceHost(virtualFiles, info.languageServiceHost, ts, ['.vue']);

			const getCompletionsAtPosition = info.languageService.getCompletionsAtPosition.bind(info.languageService);

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
				// @ts-expect-error wait for TS 5.3
				updateLevel >= (1 satisfies ts.ProgramUpdateLevel.RootNamesAndUpdate)
				|| !externalFiles.has(project)
			) {
				const oldFiles = externalFiles.get(project);
				const newFiles = searchExternalFiles(ts, project, ['.vue']);
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
