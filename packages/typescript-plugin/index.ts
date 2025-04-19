import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin';
import * as vue from '@vue/language-core';
import type * as ts from 'typescript';
import { addVueCommands } from './lib/commands';
import { proxyLanguageServiceForVue } from './lib/proxy';

const windowsPathReg = /\\/g;
const project2Service = new WeakMap<ts.server.Project, [vue.Language, ts.LanguageServiceHost, ts.LanguageService]>();

export = createLanguageServicePlugin(
	(ts, info) => {
		const vueOptions = getVueCompilerOptions();
		const languagePlugin = vue.createVueLanguagePlugin<string>(
			ts,
			info.languageServiceHost.getCompilationSettings(),
			vueOptions,
			id => id
		);

		addVueCommands(ts, info, project2Service);

		return {
			languagePlugins: [languagePlugin],
			setup: language => {
				project2Service.set(info.project, [language, info.languageServiceHost, info.languageService]);

				info.languageService = proxyLanguageServiceForVue(ts, language, info.languageService, vueOptions, fileName => fileName);

				// #3963
				const timer = setInterval(() => {
					if (info.project['program']) {
						clearInterval(timer);
						info.project['program'].__vue__ = { language };
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
