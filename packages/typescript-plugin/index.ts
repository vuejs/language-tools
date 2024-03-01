import type * as ts from 'typescript';
import { decorateLanguageService } from '@volar/typescript/lib/node/decorateLanguageService';
import { decorateLanguageServiceHost, searchExternalFiles } from '@volar/typescript/lib/node/decorateLanguageServiceHost';
import { createFileRegistry, resolveCommonLanguageId } from '@vue/language-core';
import { projects } from './lib/utils';
import * as vue from '@vue/language-core';
import { startNamedPipeServer } from './lib/server';
import { _getComponentNames } from './lib/requests/componentInfos';

const windowsPathReg = /\\/g;
const externalFiles = new WeakMap<ts.server.Project, string[]>();
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

					const vueOptions = vue.resolveVueCompilerOptions(getVueCompilerOptions());
					const languagePlugin = vue.createVueLanguagePlugin(
						ts,
						id => id,
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
								files.set(fileName, resolveCommonLanguageId(fileName), snapshot);
							}
							else {
								files.delete(fileName);
							}
						}
					);

					projectExternalFileExtensions.set(info.project, extensions);
					projects.set(info.project, {
						info,
						files,
						ts,
						vueOptions,
					});

					decorateLanguageService(files, info.languageService);
					decorateLanguageServiceHost(files, info.languageServiceHost, ts);
					startNamedPipeServer(info.project.projectKind);

					const getCompletionsAtPosition = info.languageService.getCompletionsAtPosition;
					const getEncodedSemanticClassifications = info.languageService.getEncodedSemanticClassifications;

					info.languageService.getCompletionsAtPosition = (fileName, position, options) => {
						const result = getCompletionsAtPosition(fileName, position, options);
						if (result) {
							result.entries = result.entries.filter(entry => entry.name.indexOf('__VLS_') === -1);
						}
						return result;
					};
					info.languageService.getEncodedSemanticClassifications = (fileName, span, format) => {
						const result = getEncodedSemanticClassifications(fileName, span, format);
						const file = files.get(fileName);
						if (
							file?.generated?.code instanceof vue.VueGeneratedCode
							&& file.generated.code.sfc.template
						) {
							const validComponentNames = _getComponentNames(ts, info.languageService, file.generated.code, vueOptions);
							const components = new Set([
								...validComponentNames,
								...validComponentNames.map(vue.hyphenateTag),
							]);
							const { template } = file.generated.code.sfc;
							const spanTemplateRange = [
								span.start - template.startTagEnd,
								span.start + span.length - template.startTagEnd,
							] as const;
							template.ast?.children.forEach(function visit(node) {
								if (node.loc.end.offset <= spanTemplateRange[0] || node.loc.start.offset >= spanTemplateRange[1]) {
									return;
								}
								if (node.type === 1 satisfies vue.CompilerDOM.NodeTypes.ELEMENT) {
									if (components.has(node.tag)) {
										result.spans.push(
											node.loc.start.offset + node.loc.source.indexOf(node.tag) + template.startTagEnd,
											node.tag.length,
											256, // class
										);
										if (template.lang === 'html' && !node.isSelfClosing) {
											result.spans.push(
												node.loc.start.offset + node.loc.source.lastIndexOf(node.tag) + template.startTagEnd,
												node.tag.length,
												256, // class
											);
										}
									}
									for (const child of node.children) {
										visit(child);
									}
								}
								else if (node.type === 9 satisfies vue.CompilerDOM.NodeTypes.IF) {
									for (const branch of node.branches) {
										for (const child of branch.children) {
											visit(child);
										}
									}
								}
								else if (node.type === 11 satisfies vue.CompilerDOM.NodeTypes.FOR) {
									for (const child of node.children) {
										visit(child);
									}
								}
							});
						}
						return result;
					};
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
