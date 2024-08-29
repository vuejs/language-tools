import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin';
import * as vue from '@vue/language-core';
import { proxyLanguageServiceForVue } from './lib/common';
import { startNamedPipeServer } from './lib/server';
import type * as ts from 'typescript';

const windowsPathReg = /\\/g;

const vueCompilerOptions = new WeakMap<ts.server.Project, vue.VueCompilerOptions>();

const basePlugin = createLanguageServicePlugin(
	(ts, info) => {
		const vueOptions = getVueCompilerOptions();
		const languagePlugin = vue.createVueLanguagePlugin<string>(
			ts,
			info.languageServiceHost.getCompilationSettings(),
			vueOptions,
			id => id
		);

		vueCompilerOptions.set(info.project, vueOptions);

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
const plugin: ts.server.PluginModuleFactory = mods => {
	const pluginModule = basePlugin(mods);

	return {
		...pluginModule,
		getExternalFiles(proj, updateLevel = 0) {
			const options = vueCompilerOptions.get(proj);
			if (updateLevel >= 1 && options) {
				try {
					const libDir = require.resolve(`${options.lib}/package.json`, { paths: [proj.getCurrentDirectory()] })
						.slice(0, -'package.json'.length);
					const globalTypesPath = `${libDir}dist/__global_types_${options.target}_${options.strictTemplates}.d.ts`;
					const globalTypesContents = vue.generateGlobalTypes(options.lib, options.target, options.strictTemplates);
					proj.writeFile(globalTypesPath, globalTypesContents);
				} catch { }
			}
			return pluginModule.getExternalFiles?.(proj, updateLevel) ?? [];
		},
	};
};

export = plugin;
