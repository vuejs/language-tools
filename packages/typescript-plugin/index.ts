import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin';
import * as core from '@vue/language-core';
import type * as ts from 'typescript';
import { createVueLanguageServiceProxy } from './lib/common';
import type { Requests } from './lib/requests';
import { collectExtractProps } from './lib/requests/collectExtractProps';
import { getComponentDirectives } from './lib/requests/getComponentDirectives';
import { getComponentNames } from './lib/requests/getComponentNames';
import { getComponentProps } from './lib/requests/getComponentProps';
import { getComponentSlots } from './lib/requests/getComponentSlots';
import { getElementAttrs } from './lib/requests/getElementAttrs';
import { getElementNames } from './lib/requests/getElementNames';
import { getImportPathForFile } from './lib/requests/getImportPathForFile';
import { isRefAtPosition } from './lib/requests/isRefAtPosition';

export = createLanguageServicePlugin(
	(ts, info) => {
		const vueOptions = getVueCompilerOptions();
		const languagePlugin = core.createVueLanguagePlugin<string>(
			ts,
			info.languageServiceHost.getCompilationSettings(),
			vueOptions,
			id => id,
		);
		vueOptions.globalTypesPath = core.createGlobalTypesWriter(vueOptions, ts.sys.writeFile);
		addVueCommands();

		return {
			languagePlugins: [languagePlugin],
			setup: language => {
				info.languageService = createVueLanguageServiceProxy(
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
			session.addProtocolHandler('_vue:getComponentNames', request => {
				const [fileName]: Parameters<Requests['getComponentNames']> = request.arguments;
				const { project } = getProject(fileName);
				return createResponse(getComponentNames(ts, project.getLanguageService().getProgram()!, fileName));
			});
			session.addProtocolHandler('_vue:getComponentProps', request => {
				const [fileName, position]: Parameters<Requests['getComponentProps']> = request.arguments;
				const { project, language, sourceScript, virtualCode } = getProjectAndVirtualCode(fileName);
				return createResponse(
					getComponentProps(
						ts,
						language,
						project.getLanguageService(),
						sourceScript,
						virtualCode,
						position,
						sourceScript.generated ? sourceScript.snapshot.getLength() : 0,
					),
				);
			});
			session.addProtocolHandler('_vue:getComponentSlots', request => {
				const [fileName]: Parameters<Requests['getComponentSlots']> = request.arguments;
				const { project, virtualCode } = getProjectAndVirtualCode(fileName);
				return createResponse(getComponentSlots(ts, project.getLanguageService().getProgram()!, virtualCode));
			});
			session.addProtocolHandler('_vue:getElementAttrs', request => {
				const [fileName, tag]: Parameters<Requests['getElementAttrs']> = request.arguments;
				const { project } = getProject(fileName);
				return createResponse(getElementAttrs(ts, project.getLanguageService().getProgram()!, tag));
			});
			session.addProtocolHandler('_vue:getElementNames', request => {
				const [fileName]: Parameters<Requests['getElementNames']> = request.arguments;
				const { project } = getProject(fileName);
				return createResponse(getElementNames(ts, project.getLanguageService().getProgram()!));
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
					language: (project as any).__vue__.language,
				};
			}
		}
	},
);
