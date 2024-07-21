import { createLanguageServicePlugin, externalFiles } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin';
import * as vue from '@vue/language-core';
import { proxyLanguageServiceForVue } from './lib/common';
import { startNamedPipeServer } from './lib/server';

const windowsPathReg = /\\/g;

const plugin = createLanguageServicePlugin(
	(ts, info) => {
		const vueOptions = getVueCompilerOptions();
		const languagePlugin = vue.createVueLanguagePlugin2<string>(
			ts,
			id => id,
			info.project.projectKind === ts.server.ProjectKind.Inferred
				? () => true
				: vue.createRootFileChecker(
					info.languageServiceHost.getProjectVersion ? () => info.languageServiceHost.getProjectVersion!() : undefined,
					() => externalFiles.get(info.project) ?? [],
					info.languageServiceHost.useCaseSensitiveFileNames?.() ?? false
				),
			info.languageServiceHost.getCompilationSettings(),
			vueOptions
		);

		return {
			languagePlugins: [languagePlugin],
			setup: language => {
				info.languageService = proxyLanguageServiceForVue(ts, language, info.languageService, vueOptions, fileName => fileName);
				if (
					info.project.projectKind === ts.server.ProjectKind.Configured
					|| info.project.projectKind === ts.server.ProjectKind.Inferred
				) {
					startNamedPipeServer(ts, info, language, info.project.projectKind);
				}

				// #3963
				const timer = setInterval(() => {
					if (info.project['program']) {
						clearInterval(timer);
						(info.project['program'] as any).__vue__ = { language };
					}
				}, 50);
			}
		};

		function getVueCompilerOptions() {
			if (info.project.projectKind === ts.server.ProjectKind.Configured) {
				const tsconfig = info.project.getProjectName();
				return vue.createParsedCommandLine(ts, ts.sys, tsconfig.replace(windowsPathReg, '/')).vueOptions;
			}
			else {
				return vue.createParsedCommandLineByJson(ts, ts.sys, info.languageServiceHost.getCurrentDirectory(), {}).vueOptions;
			}
		}
	}
);

export = plugin;
