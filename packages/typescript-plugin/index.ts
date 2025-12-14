import { transformFileTextChanges } from '@volar/typescript/lib/node/transform.js';
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
import type { Requests } from './lib/requests';
import { collectExtractProps } from './lib/requests/collectExtractProps';
import { getComponentDirectives } from './lib/requests/getComponentDirectives';
import { getComponentEvents } from './lib/requests/getComponentEvents';
import { getComponentNames } from './lib/requests/getComponentNames';
import { getComponentProps } from './lib/requests/getComponentProps';
import { getComponentSlots } from './lib/requests/getComponentSlots';
import { getElementAttrs } from './lib/requests/getElementAttrs';
import { getElementNames } from './lib/requests/getElementNames';
import { getImportPathForFile } from './lib/requests/getImportPathForFile';
import { isRefAtPosition } from './lib/requests/isRefAtPosition';
import { resolveModuleName } from './lib/requests/resolveModuleName';

const projectToOriginalLanguageService = new WeakMap<ts.server.Project, ts.LanguageService>();

export = createLanguageServicePlugin(
	(ts, info) => {
		projectToOriginalLanguageService.set(info.project, info.languageService);

		const vueOptions = getVueCompilerOptions();
		const languagePlugin = core.createVueLanguagePlugin<string>(
			ts,
			info.languageServiceHost.getCompilationSettings(),
			vueOptions,
			id => id,
		);
		addVueCommands();

		let _language: core.Language<string> | undefined;
		preprocessLanguageService(info.languageService, () => _language);

		return {
			languagePlugins: [languagePlugin],
			setup: language => {
				_language = language;
				info.languageService = postprocessLanguageService(
					ts,
					language,
					info.languageService,
					vueOptions,
					fileName => fileName,
				);
				(info.project as any).__vue__ = { language };
			},
		};

		function getVueCompilerOptions() {
			if (info.project.projectKind === ts.server.ProjectKind.Configured) {
				const tsconfig = info.project.getProjectName();
				return core.createParsedCommandLine(ts, ts.sys, tsconfig.replace(/\\/g, '/')).vueOptions;
			}
			else {
				return core.createParsedCommandLineByJson(ts, ts.sys, info.languageServiceHost.getCurrentDirectory(), {})
					.vueOptions;
			}
		}

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
			if (handlers.has('_vue:projectInfo')) {
				return;
			}

			session.addProtocolHandler('_vue:projectInfo', request => {
				return handlers.get('projectInfo')!(request);
			});
			session.addProtocolHandler('_vue:documentHighlights-full', request => {
				return handlers.get('documentHighlights-full')!(request);
			});
			session.addProtocolHandler('_vue:encodedSemanticClassifications-full', request => {
				return handlers.get('encodedSemanticClassifications-full')!(request);
			});
			session.addProtocolHandler('_vue:quickinfo', request => {
				return handlers.get('quickinfo')!(request);
			});
			session.addProtocolHandler(
				'_vue:collectExtractProps',
				request => {
					const [fileName, templateCodeRange]: Parameters<Requests['collectExtractProps']> = request.arguments;
					const { project, language, sourceScript, virtualCode } = getProjectAndVirtualCode(fileName);
					return createResponse(
						collectExtractProps(
							ts,
							language,
							project.getLanguageService().getProgram()!,
							sourceScript,
							virtualCode,
							templateCodeRange,
							sourceScript.generated ? sourceScript.snapshot.getLength() : 0,
						),
					);
				},
			);
			session.addProtocolHandler('_vue:getImportPathForFile', request => {
				const [fileName, incomingFileName, preferences]: Parameters<Requests['getImportPathForFile']> =
					request.arguments;
				const { project } = getProject(fileName);
				return createResponse(
					getImportPathForFile(
						ts,
						project,
						project.getLanguageService().getProgram()!,
						fileName,
						incomingFileName,
						preferences,
					),
				);
			});
			session.addProtocolHandler('_vue:getAutoImportSuggestions', request => {
				const [fileName, position]: Parameters<Requests['getAutoImportSuggestions']> = request.arguments;
				const { project, language, sourceScript, virtualCode } = getProjectAndVirtualCode(fileName);
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
								const data = (entry.data as VueCompletionData)!;
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
							const data = (entry.data as VueCompletionData)!;
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
			session.addProtocolHandler('_vue:isRefAtPosition', request => {
				const [fileName, position]: Parameters<Requests['isRefAtPosition']> = request.arguments;
				const { project, language, sourceScript, virtualCode } = getProjectAndVirtualCode(fileName);
				return createResponse(
					isRefAtPosition(
						ts,
						language,
						project.getLanguageService().getProgram()!,
						sourceScript,
						virtualCode,
						position,
						sourceScript.generated ? sourceScript.snapshot.getLength() : 0,
					),
				);
			});
			session.addProtocolHandler('_vue:getComponentDirectives', request => {
				const [fileName]: Parameters<Requests['getComponentDirectives']> = request.arguments;
				const { project } = getProject(fileName);
				return createResponse(getComponentDirectives(ts, project.getLanguageService().getProgram()!, fileName));
			});
			session.addProtocolHandler('_vue:getComponentEvents', request => {
				const [fileName, tag]: Parameters<Requests['getComponentEvents']> = request.arguments;
				const { project, virtualCode } = getProjectAndVirtualCode(fileName);
				return createResponse(getComponentEvents(ts, project.getLanguageService().getProgram()!, virtualCode, tag));
			});
			session.addProtocolHandler('_vue:getComponentNames', request => {
				const [fileName]: Parameters<Requests['getComponentNames']> = request.arguments;
				const { project, virtualCode } = getProjectAndVirtualCode(fileName);
				return createResponse(getComponentNames(ts, project.getLanguageService().getProgram()!, virtualCode));
			});
			session.addProtocolHandler('_vue:getComponentProps', request => {
				const [fileName, tag]: Parameters<Requests['getComponentProps']> = request.arguments;
				const { project, virtualCode } = getProjectAndVirtualCode(fileName);
				return createResponse(getComponentProps(ts, project.getLanguageService().getProgram()!, virtualCode, tag));
			});
			session.addProtocolHandler('_vue:getComponentSlots', request => {
				const [fileName]: Parameters<Requests['getComponentSlots']> = request.arguments;
				const { project, virtualCode } = getProjectAndVirtualCode(fileName);
				return createResponse(getComponentSlots(ts, project.getLanguageService().getProgram()!, virtualCode));
			});
			session.addProtocolHandler('_vue:getElementAttrs', request => {
				const [fileName, tag]: Parameters<Requests['getElementAttrs']> = request.arguments;
				const { project } = getProject(fileName);
				return createResponse(getElementAttrs(ts, project.getLanguageService().getProgram()!, fileName, tag));
			});
			session.addProtocolHandler('_vue:getElementNames', request => {
				const [fileName]: Parameters<Requests['getElementNames']> = request.arguments;
				const { project } = getProject(fileName);
				return createResponse(getElementNames(ts, project.getLanguageService().getProgram()!, fileName));
			});
			session.addProtocolHandler('_vue:resolveModuleName', request => {
				const [fileName, moduleName]: Parameters<Requests['resolveModuleName']> = request.arguments;
				return createResponse(resolveModuleName(ts, info.languageServiceHost, fileName, moduleName));
			});

			projectService.logger.info('Vue specific commands are successfully added.');

			function createResponse(res: any): ts.server.HandlerResponse {
				return {
					response: res,
					responseRequired: true,
				};
			}

			function getProjectAndVirtualCode(fileName: string) {
				const service = getProject(fileName);
				const sourceScript = service.language.scripts.get(fileName);
				if (!sourceScript) {
					throw new Error('No source script found for file: ' + fileName);
				}
				const virtualCode = sourceScript.generated?.root;
				if (!(virtualCode instanceof core.VueVirtualCode)) {
					throw new Error('No virtual code found for file: ' + fileName);
				}
				return {
					...service,
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
					language: (project as any).__vue__.language as core.Language<string>,
				};
			}
		}
	},
);
