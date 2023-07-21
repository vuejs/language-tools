import * as vue from '@vue/language-core';
import { decorateLanguageService, decorateLanguageServiceHost, getExternalFiles } from '@vue/typescript';
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
		getExternalFiles(project) {
			if (!externalFiles.has(project)) {
				externalFiles.set(project, getExternalFiles(ts, project, ['.vue']));
			}
			return externalFiles.get(project)!;
		},
	};
	return pluginModule;
};

export = init;
