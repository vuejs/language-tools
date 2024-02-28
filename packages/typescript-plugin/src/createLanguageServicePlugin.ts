import type * as ts from 'typescript';
import { decorateLanguageService } from '@volar/typescript/lib/node/decorateLanguageService';
import { decorateLanguageServiceHost, searchExternalFiles } from '@volar/typescript/lib/node/decorateLanguageServiceHost';
import { createFileRegistry, LanguagePlugin, resolveCommonLanguageId } from '@vue/language-core';
import { projects } from './requests/utils';

const externalFiles = new WeakMap<ts.server.Project, string[]>();
const projectExternalFileExtensions = new WeakMap<ts.server.Project, string[]>();
const decoratedLanguageServices = new WeakSet<ts.LanguageService>();
const decoratedLanguageServiceHosts = new WeakSet<ts.LanguageServiceHost>();

export function createLanguageServicePlugin(
	loadLanguagePlugins: (
		ts: typeof import('typescript'),
		info: ts.server.PluginCreateInfo
	) => LanguagePlugin[]
): ts.server.PluginModuleFactory {
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

					const languagePlugins = loadLanguagePlugins(ts, info);
					const extensions = languagePlugins
						.map(plugin => plugin.typescript?.extraFileExtensions.map(ext => '.' + ext.extension) ?? [])
						.flat();
					projectExternalFileExtensions.set(info.project, extensions);
					const getScriptSnapshot = info.languageServiceHost.getScriptSnapshot.bind(info.languageServiceHost);
					const files = createFileRegistry(
						languagePlugins,
						ts.sys.useCaseSensitiveFileNames,
						fileName => {
							const snapshot = getScriptSnapshot(fileName);
							if (snapshot) {
								files.set(fileName, resolveCommonLanguageId(fileName), snapshot);
							}
							else {
								files.delete(fileName);
							}
						}
					);

					projects.set(info.project, [info, files, ts]);

					decorateLanguageService(files, info.languageService);
					decorateLanguageServiceHost(files, info.languageServiceHost, ts);
				}

				return info.languageService;
			},
			getExternalFiles(project, updateLevel = 0) {
				if (
					updateLevel >= (1 satisfies ts.ProgramUpdateLevel.RootNamesAndUpdate)
					|| !externalFiles.has(project)
				) {
					const oldFiles = externalFiles.get(project);
					const newFiles = searchExternalFiles(ts, project, projectExternalFileExtensions.get(project)!);
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
}

export function arrayItemsEqual(a: string[], b: string[]) {
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
