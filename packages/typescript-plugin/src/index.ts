import { decorateLanguageService, decorateLanguageServiceHost, searchExternalFiles } from '@volar/typescript';
import * as vue from '@vue/language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';

const externalFiles = new WeakMap<ts.server.Project, string[]>();

const init: ts.server.PluginModuleFactory = (modules) => {
	const { typescript: ts } = modules;
	const pluginModule: ts.server.PluginModule = {
		create(info) {

			const virtualFiles = vue.createVirtualFiles(
				vue.createLanguages(
					info.languageServiceHost.getCompilationSettings(),
					getVueCompilerOptions(),
					ts,
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
					return vue.createParsedCommandLine(ts, ts.sys, tsconfig).vueOptions;
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
				const newFiles = searchExternalFiles(ts, project, ['.vue']);
				externalFiles.set(project, newFiles);
				if (oldFiles) {
					refreshDiagnosticsIfNeeded(project, oldFiles, newFiles);
				}
			}
			return externalFiles.get(project)!;
		},
	};
	return pluginModule;
};

export = init;

function refreshDiagnosticsIfNeeded(project: ts.server.Project, oldExternalFiles: string[], newExternalFiles: string[]) {
	let dirty = oldExternalFiles.length !== newExternalFiles.length;
	if (!dirty) {
		const set = new Set(oldExternalFiles);
		for (const file of newExternalFiles) {
			if (!set.has(file)) {
				dirty = true;
				break;
			}
		}
	}
	if (dirty) {
		project.refreshDiagnostics();
	}
}
