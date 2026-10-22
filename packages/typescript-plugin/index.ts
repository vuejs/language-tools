import { transformFileTextChanges } from '@volar/typescript/lib/node/transform';
import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin';
import * as core from '@vue/language-core';
import type * as ts from 'typescript';
import {
	postprocessLanguageService,
	preprocessLanguageService,
	resolveCompletionEntryDetails,
	resolveCompletionResult,
	type VueCompletionData,
} from './lib/common';
import { getExtensionFormats } from './lib/contentMappers';
import type { Requests } from './lib/requests';
import { collectExtractProps } from './lib/requests/collectExtractProps';
import { getComponentNames } from './lib/requests/getComponentNames';
import { getComponentProps } from './lib/requests/getComponentProps';
import { getComponentSlots } from './lib/requests/getComponentSlots';
import { getElementAttrs } from './lib/requests/getElementAttrs';
import { isRefAtPosition } from './lib/requests/isRefAtPosition';

const projectToOriginalLanguageService = new WeakMap<ts.server.Project, ts.LanguageService>();

export = createLanguageServicePlugin(
	(ts, info) => {
		projectToOriginalLanguageService.set(info.project, info.languageService);

		const configFileName = info.project.projectKind === ts.server.ProjectKind.Configured
			? info.project.getProjectName().replace(/\\/g, '/')
			: undefined;
		const vueOptions = configFileName
			? core.createParsedCommandLine(ts, ts.sys, configFileName).vueOptions
			: core.createParsedCommandLineByJson(ts, ts.sys, info.languageServiceHost.getCurrentDirectory(), {}).vueOptions;
		const extensionFormats = getExtensionFormats(ts, ts.sys, configFileName);
		const extensions = Object.keys(extensionFormats);
		// Each file goes to the plugin of its longest matching extension, parsed by that extension's format.
		const languagePlugins = Object.entries(extensionFormats)
			.sort(([a], [b]) => b.length - a.length)
			.map(([extension, format]): core.LanguagePlugin<string> => {
				const vuePlugin = core.createVueLanguagePlugin<string>(ts, { ...vueOptions, format }, id => id);
				return {
					...vuePlugin,
					getLanguageId: fileName => fileName.endsWith(extension) ? vuePlugin.getLanguageId(fileName) : undefined,
					createVirtualCode: (fileName, languageId, snapshot, ctx) =>
						fileName.endsWith(extension)
							? vuePlugin.createVirtualCode!(fileName, languageId, snapshot, ctx)
							: undefined,
					typescript: {
						...vuePlugin.typescript!,
						extraFileExtensions: [{
							extension: extension.slice(1),
							isMixedContent: true,
							scriptKind: 7 satisfies ts.ScriptKind.Deferred,
						}],
					},
				};
			});
		addVueCommands();

		let _language: core.Language<string> | undefined;
		info.languageService = preprocessLanguageService(info.languageService, () => _language);

		return {
			languagePlugins,
			setup: language => {
				_language = language;
				info.languageService = postprocessLanguageService(
					ts,
					language,
					info.languageService,
					vueOptions,
					extensions,
					fileName => fileName,
				);
				(info.project as any).__vue__ = { language, vueOptions, extensions };
			},
		};

		// https://github.com/JetBrains/intellij-plugins/blob/6435723ad88fa296b41144162ebe3b8513f4949b/Angular/src-js/angular-service/src/index.ts#L69
		function addVueCommands() {
			const projectService = info.project.projectService;
			projectService.logger.info('Vue: called handler processing ' + info.project.projectKind);

			if (!info.session) {
				projectService.logger.info('Vue: there is no session in info.');
				return;
			}
			const session = info.session;
			if (!(session.addProtocolHandler as Function | undefined)) {
				// addProtocolHandler was introduced in TS 4.4 or 4.5 in 2021, see https://github.com/microsoft/TypeScript/issues/43893
				projectService.logger.info('Vue: there is no addProtocolHandler method.');
				return;
			}
			// @ts-expect-error
			const handlers = session.handlers as Map<
				string,
				(request: ts.server.protocol.Request) => ts.server.HandlerResponse
			>;
			if (handlers.has('_vue:collectExtractProps')) {
				return;
			}

			session.addProtocolHandler(
				'_vue:collectExtractProps',
				request => {
					const [fileName, templateCodeRange]: Parameters<Requests['collectExtractProps']> = request.arguments;
					const { program, language, sourceScript, virtualCode } = getProjectAndVirtualCode(fileName);
					return createResponse(
						collectExtractProps(
							ts,
							language,
							program,
							sourceScript,
							virtualCode,
							templateCodeRange,
							sourceScript.generated ? sourceScript.snapshot.getLength() : 0,
						),
					);
				},
			);
			session.addProtocolHandler('_vue:getAutoImportSuggestions', request => {
				const [fileName, position]: Parameters<Requests['getAutoImportSuggestions']> = request.arguments;
				const { project, language, vueOptions, extensions, sourceScript, virtualCode } = getProjectAndVirtualCode(
					fileName,
				);
				const tsLanguageService = projectToOriginalLanguageService.get(project);
				if (!tsLanguageService) {
					return createResponse(undefined);
				}
				for (const code of core.forEachEmbeddedCode(virtualCode)) {
					if (!code.id.startsWith('script_')) {
						continue;
					}
					const map = language.maps.get(code, sourceScript);
					for (const [tsPosition, mapping] of map.toGeneratedLocation(position)) {
						if (!(mapping.data as core.VueCodeInformation).__importCompletion) {
							continue;
						}
						const tsPosition2 = tsPosition + sourceScript.snapshot.getLength();
						const result = tsLanguageService.getCompletionsAtPosition(
							fileName,
							tsPosition2,
							session['getPreferences'](fileName),
							session['getFormatOptions'](fileName),
						);
						if (result) {
							resolveCompletionResult(
								ts,
								language,
								fileName => fileName,
								vueOptions,
								extensions,
								fileName,
								position,
								result,
							);
							result.entries = result.entries
								.filter(entry => {
									const data = entry.data as VueCompletionData;
									return data?.__vue__componentAutoImport || data?.__vue__autoImport;
								});
							for (const entry of result.entries) {
								const data = entry.data as VueCompletionData;
								if (!data) {
									continue;
								}
								data.__vue__autoImportSuggestions = {
									fileName,
									position: tsPosition + sourceScript.snapshot.getLength(),
									entryName: data.__vue__componentAutoImport?.oldName ?? entry.name,
									source: entry.source,
								};
							}
						}
						return createResponse(result);
					}
					const result = tsLanguageService.getCompletionsAtPosition(
						fileName,
						0,
						session['getPreferences'](fileName),
						session['getFormatOptions'](fileName),
					);
					if (result) {
						resolveCompletionResult(
							ts,
							language,
							fileName => fileName,
							vueOptions,
							extensions,
							fileName,
							position,
							result,
						);
						result.entries = result.entries
							.filter(entry => {
								const data = entry.data as VueCompletionData;
								return data?.__vue__componentAutoImport || data?.__vue__autoImport;
							});
						for (const entry of result.entries) {
							const data = entry.data as VueCompletionData;
							if (!data) {
								continue;
							}
							data.__vue__autoImportSuggestions = {
								fileName,
								position: 0,
								entryName: data.__vue__componentAutoImport?.oldName ?? entry.name,
								source: entry.source,
							};
						}
						return createResponse(result);
					}
				}
				return createResponse(undefined);
			});
			session.addProtocolHandler('_vue:resolveAutoImportCompletionEntry', request => {
				const [data]: Parameters<Requests['resolveAutoImportCompletionEntry']> = request.arguments;
				if (!data?.__vue__autoImportSuggestions) {
					return createResponse(undefined);
				}
				const { fileName, position, entryName, source } = data.__vue__autoImportSuggestions;
				const { project, language } = getProject(fileName);
				const tsLanguageService = projectToOriginalLanguageService.get(project);
				if (!tsLanguageService) {
					return createResponse(undefined);
				}
				const details = tsLanguageService.getCompletionEntryDetails(
					fileName,
					position,
					entryName,
					session['getFormatOptions'](fileName),
					source,
					session['getPreferences'](fileName),
					data,
				);
				if (details) {
					for (const codeAction of details.codeActions ?? []) {
						codeAction.changes = transformFileTextChanges(
							language,
							codeAction.changes,
							false,
							core.isCompletionEnabled,
						);
					}
					resolveCompletionEntryDetails(language, details, data);
				}
				return createResponse(details);
			});
			session.addProtocolHandler('_vue:getComponentNames', request => {
				const [fileName]: Parameters<Requests['getComponentNames']> = request.arguments;
				const { program, virtualCode } = getProjectAndVirtualCode(fileName);
				return createResponse(getComponentNames(ts, program, virtualCode));
			});
			session.addProtocolHandler('_vue:getComponentProps', request => {
				const [fileName, position]: Parameters<Requests['getComponentProps']> = request.arguments;
				const { project, program, language, sourceScript, virtualCode } = getProjectAndVirtualCode(fileName);
				const tsLanguageService = projectToOriginalLanguageService.get(project);
				if (!tsLanguageService) {
					return createResponse(undefined);
				}
				return createResponse(
					getComponentProps(
						ts,
						tsLanguageService,
						program,
						language,
						sourceScript,
						virtualCode,
						position,
					),
				);
			});
			session.addProtocolHandler('_vue:getComponentSlots', request => {
				const [fileName]: Parameters<Requests['getComponentSlots']> = request.arguments;
				const { program, virtualCode } = getProjectAndVirtualCode(fileName);
				return createResponse(getComponentSlots(ts, program, virtualCode));
			});
			session.addProtocolHandler('_vue:getElementAttrs', request => {
				const [fileName, ...args]: Parameters<Requests['getElementAttrs']> = request.arguments;
				const { program } = getProject(fileName);
				return createResponse(getElementAttrs(ts, program, fileName, ...args));
			});
			session.addProtocolHandler('_vue:isRefAtPosition', request => {
				const [fileName, position]: Parameters<Requests['isRefAtPosition']> = request.arguments;
				const { program, language, sourceScript, virtualCode } = getProjectAndVirtualCode(fileName);
				return createResponse(
					isRefAtPosition(
						ts,
						language,
						program,
						sourceScript,
						virtualCode,
						position,
					),
				);
			});

			projectService.logger.info('Vue specific commands are successfully added.');

			function createResponse(res: any): ts.server.HandlerResponse {
				return {
					response: res,
					responseRequired: true,
				};
			}

			function getProjectAndVirtualCode(fileName: string) {
				const project = getProject(fileName);
				const sourceScript = project.language.scripts.get(fileName);
				if (!sourceScript) {
					throw new Error('No source script found for file: ' + fileName);
				}
				const virtualCode = sourceScript.generated?.root;
				if (!(virtualCode instanceof core.VueVirtualCode)) {
					throw new Error('No virtual code found for file: ' + fileName);
				}
				return {
					...project,
					sourceScript,
					virtualCode,
				};
			}

			function getProject(fileName: string) {
				const { project } = session['getFileAndProject']({
					file: fileName,
					projectFileName: undefined,
				}) as {
					file: ts.server.NormalizedPath;
					project: ts.server.Project;
				};
				if (!('__vue__' in project)) {
					throw new Error('No vue project info for project: ' + project.getProjectName());
				}
				return {
					project,
					program: project.getLanguageService().getProgram()!,
					language: (project as any).__vue__.language as core.Language<string>,
					vueOptions: (project as any).__vue__.vueOptions as core.VueCompilerOptions,
					extensions: (project as any).__vue__.extensions as string[],
				};
			}
		}
	},
);
