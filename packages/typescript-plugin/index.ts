import { decorateLanguageService } from '@volar/typescript/lib/node/decorateLanguageService';
import { decorateLanguageServiceHost, searchExternalFiles } from '@volar/typescript/lib/node/decorateLanguageServiceHost';
import * as vue from '@vue/language-core';
import { createFileRegistry, resolveCommonLanguageId } from '@vue/language-core';
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
						fileName => {
							if (info.languageServiceHost.useCaseSensitiveFileNames?.() ?? false) {
								return externalFiles.get(info.project)?.has(fileName) ?? false;
							}
							else {
								const lowerFileName = fileName.toLowerCase();
								for (const externalFile of externalFiles.get(info.project) ?? []) {
									if (externalFile.toLowerCase() === lowerFileName) {
										return true;
									}
								}
								return false;
							}
						},
						info.languageServiceHost.getCompilationSettings(),
						vueOptions,
					);
					const extensions = languagePlugin.typescript?.extraFileExtensions.map(ext => '.' + ext.extension) ?? [];
					const getScriptSnapshot = info.languageServiceHost.getScriptSnapshot.bind(info.languageServiceHost);
					const files = createFileRegistry(
						[languagePlugin],
						ts.sys.useCaseSensitiveFileNames,
						fileName => {
							const snapshot = getScriptSnapshot(fileName);
							if (snapshot) {
								let languageId = resolveCommonLanguageId(fileName);
								if (extensions.some(ext => fileName.endsWith(ext))) {
									languageId = 'vue';
								}
								files.set(fileName, languageId, snapshot);
							}
							else {
								files.delete(fileName);
							}
						}
					);

					projectExternalFileExtensions.set(info.project, extensions);
					projects.set(info.project, { info, files, vueOptions });

					decorateLanguageService(files, info.languageService);
					decorateLanguageServiceForVue(files, info.languageService, vueOptions, ts, true);
					decorateLanguageServiceHost(files, info.languageServiceHost, ts);
					startNamedPipeServer(ts, info.project.projectKind, info.project.getCurrentDirectory());
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
								projects.get(project)?.files.delete(oldFile);
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
