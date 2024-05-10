import { decorateLanguageService } from '@volar/typescript/lib/node/decorateLanguageService';
import { decorateLanguageServiceHost, searchExternalFiles } from '@volar/typescript/lib/node/decorateLanguageServiceHost';
import * as vue from '@vue/language-core';
import { createLanguage } from '@vue/language-core';
import type * as ts from 'typescript';
import { decorateLanguageServiceForVue } from './lib/common';
import { startNamedPipeServer, projects } from './lib/server';

const windowsPathReg = /\\/g;
const externalFiles = new WeakMap<ts.server.Project, Set<string>>();
const projectExternalFileExtensions = new WeakMap<ts.server.Project, string[]>();
const decoratedLanguageServices = new WeakSet<ts.LanguageService>();
const decoratedLanguageServiceHosts = new WeakSet<ts.LanguageServiceHost>();

export = createLanguageServicePlugin();

function createLanguageServicePlugin(): ts.server.PluginModuleFactory {
	return modules => {
		const { typescript: ts } = modules;
		const pluginModule: ts.server.PluginModule = {
			create(info) {
				if (
					!decoratedLanguageServices.has(info.languageService)
					&& !decoratedLanguageServiceHosts.has(info.languageServiceHost)
				) {
					decoratedLanguageServices.add(info.languageService);
					decoratedLanguageServiceHosts.add(info.languageServiceHost);

					const vueOptions = getVueCompilerOptions();
					const languagePlugin = vue.createVueLanguagePlugin(
						ts,
						id => id,
						info.languageServiceHost.useCaseSensitiveFileNames?.() ?? false,
						() => info.languageServiceHost.getProjectVersion?.() ?? '',
						() => externalFiles.get(info.project) ?? [],
						info.languageServiceHost.getCompilationSettings(),
						vueOptions,
					);
					const extensions = languagePlugin.typescript?.extraFileExtensions.map(ext => '.' + ext.extension) ?? [];
					const getScriptSnapshot = info.languageServiceHost.getScriptSnapshot.bind(info.languageServiceHost);
					const getScriptVersion = info.languageServiceHost.getScriptVersion.bind(info.languageServiceHost);
					const syncedScriptVersions = new vue.FileMap<string>(ts.sys.useCaseSensitiveFileNames);
					const language = createLanguage(
						[languagePlugin],
						ts.sys.useCaseSensitiveFileNames,
						fileName => {
							const version = getScriptVersion(fileName);
							if (syncedScriptVersions.get(fileName) === version) {
								return;
							}
							syncedScriptVersions.set(fileName, version);

							const snapshot = getScriptSnapshot(fileName);
							if (snapshot) {
								language.scripts.set(fileName, snapshot);
							}
							else {
								language.scripts.delete(fileName);
							}
						}
					);

					projectExternalFileExtensions.set(info.project, extensions);
					projects.set(info.project, { info, language, vueOptions });

					decorateLanguageService(language, info.languageService);
					decorateLanguageServiceForVue(language, info.languageService, vueOptions, ts, true, fileName => fileName);
					decorateLanguageServiceHost(ts, language, info.languageServiceHost);
					startNamedPipeServer(ts, info.project.projectKind, info.project.getCurrentDirectory());

					// #3963
					const timer = setInterval(() => {
						if (info.project['program']) {
							clearInterval(timer);
							(info.project['program'] as any).__vue__ = { language };
						}
					}, 50);
				}

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
					const newFiles = new Set(searchExternalFiles(ts, project, projectExternalFileExtensions.get(project)!));
					externalFiles.set(project, newFiles);
					if (oldFiles && !twoSetsEqual(oldFiles, newFiles)) {
						for (const oldFile of oldFiles) {
							if (!newFiles.has(oldFile)) {
								projects.get(project)?.language.scripts.delete(oldFile);
							}
						}
						project.refreshDiagnostics();
					}
				}
				return [...externalFiles.get(project)!];
			},
		};
		return pluginModule;
	};
}

function twoSetsEqual(a: Set<string>, b: Set<string>) {
	if (a.size !== b.size) {
		return false;
	}
	for (const file of a) {
		if (!b.has(file)) {
			return false;
		}
	}
	return true;
}
