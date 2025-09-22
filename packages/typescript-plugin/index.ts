import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin';
import * as vue from '@vue/language-core';
import type * as ts from 'typescript';
import { createVueLanguageServiceProxy } from './lib/common';
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
import { getReactivityAnalysis } from './lib/requests/getReactivityAnalysis';
import { isRefAtPosition } from './lib/requests/isRefAtPosition';

const windowsPathReg = /\\/g;
const project2Service = new WeakMap<
	ts.server.Project,
	[vue.Language<string>, ts.LanguageServiceHost, ts.LanguageService]
>();

export = createLanguageServicePlugin(
	(ts, info) => {
		const vueOptions = getVueCompilerOptions();
		const languagePlugin = vue.createVueLanguagePlugin<string>(
			ts,
			info.languageServiceHost.getCompilationSettings(),
			vueOptions,
			id => id,
		);

		vue.writeGlobalTypes(vueOptions, ts.sys.writeFile);
		addVueCommands();

		return {
			languagePlugins: [languagePlugin],
			setup: language => {
				project2Service.set(info.project, [language, info.languageServiceHost, info.languageService]);

				info.languageService = createVueLanguageServiceProxy(
					ts,
					language,
					info.languageService,
					vueOptions,
					fileName => fileName,
				);

				// #3963
				const timer = setInterval(() => {
					if (info.project['program']) {
						clearInterval(timer);
						info.project['program'].__vue__ = { language };
					}
				}, 50);
			},
		};

		function getVueCompilerOptions() {
			if (info.project.projectKind === ts.server.ProjectKind.Configured) {
				const tsconfig = info.project.getProjectName();
				return vue.createParsedCommandLine(ts, ts.sys, tsconfig.replace(windowsPathReg, '/')).vueOptions;
			}
			else {
				return vue.createParsedCommandLineByJson(ts, ts.sys, info.languageServiceHost.getCurrentDirectory(), {})
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
					const { language, languageService, sourceScript, virtualCode } = getLanguageServiceAndVirtualCode(fileName);
					return createResponse(
						collectExtractProps(
							ts,
							language,
							languageService.getProgram()!,
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
				const { languageServiceHost, languageService } = getLanguageService(fileName);
				return createResponse(
					getImportPathForFile(
						ts,
						languageServiceHost,
						languageService.getProgram()!,
						fileName,
						incomingFileName,
						preferences,
					),
				);
			});
			session.addProtocolHandler('_vue:isRefAtPosition', request => {
				const [fileName, position]: Parameters<Requests['isRefAtPosition']> = request.arguments;
				const { language, languageService, sourceScript, virtualCode } = getLanguageServiceAndVirtualCode(fileName);
				return createResponse(
					isRefAtPosition(
						ts,
						language,
						languageService.getProgram()!,
						sourceScript,
						virtualCode,
						position,
						sourceScript.generated ? sourceScript.snapshot.getLength() : 0,
					),
				);
			});
			session.addProtocolHandler('_vue:getComponentDirectives', request => {
				const [fileName]: Parameters<Requests['getComponentDirectives']> = request.arguments;
				const { languageService } = getLanguageService(fileName);
				return createResponse(getComponentDirectives(ts, languageService.getProgram()!, fileName));
			});
			session.addProtocolHandler('_vue:getComponentEvents', request => {
				const [fileName, tag]: Parameters<Requests['getComponentEvents']> = request.arguments;
				const { languageService } = getLanguageService(fileName);
				return createResponse(getComponentEvents(ts, languageService.getProgram()!, fileName, tag));
			});
			session.addProtocolHandler('_vue:getComponentNames', request => {
				const [fileName]: Parameters<Requests['getComponentNames']> = request.arguments;
				const { languageService } = getLanguageService(fileName);
				return createResponse(getComponentNames(ts, languageService.getProgram()!, fileName));
			});
			session.addProtocolHandler('_vue:getComponentProps', request => {
				const [fileName, tag]: Parameters<Requests['getComponentProps']> = request.arguments;
				const { languageService } = getLanguageService(fileName);
				return createResponse(getComponentProps(ts, languageService.getProgram()!, fileName, tag));
			});
			session.addProtocolHandler('_vue:getComponentSlots', request => {
				const [fileName]: Parameters<Requests['getComponentSlots']> = request.arguments;
				const { languageService, virtualCode } = getLanguageServiceAndVirtualCode(fileName);
				return createResponse(getComponentSlots(ts, languageService.getProgram()!, virtualCode));
			});
			session.addProtocolHandler('_vue:getElementAttrs', request => {
				const [fileName, tag]: Parameters<Requests['getElementAttrs']> = request.arguments;
				const { languageService } = getLanguageService(fileName);
				return createResponse(getElementAttrs(ts, languageService.getProgram()!, fileName, tag));
			});
			session.addProtocolHandler('_vue:getElementNames', request => {
				const [fileName]: Parameters<Requests['getElementNames']> = request.arguments;
				const { languageService } = getLanguageService(fileName);
				return createResponse(getElementNames(ts, languageService.getProgram()!, fileName));
			});
			session.addProtocolHandler('_vue:getReactivityAnalysis', request => {
				const [fileName, position]: Parameters<Requests['getReactivityAnalysis']> = request.arguments;
				const { language } = getLanguageService(fileName);
				const sourceScript = language.scripts.get(fileName)!;
				return createResponse(
					getReactivityAnalysis(
						ts,
						language,
						sourceScript,
						fileName,
						position,
						sourceScript.generated ? sourceScript.snapshot.getLength() : 0,
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

			function getLanguageServiceAndVirtualCode(fileName: string) {
				const service = getLanguageService(fileName);
				const sourceScript = service.language.scripts.get(fileName);
				if (!sourceScript) {
					throw new Error('No source script found for file: ' + fileName);
				}
				const virtualCode = sourceScript.generated?.root;
				if (!(virtualCode instanceof vue.VueVirtualCode)) {
					throw new Error('No virtual code found for file: ' + fileName);
				}
				return {
					...service,
					sourceScript,
					virtualCode,
				};
			}

			function getLanguageService(fileName: string) {
				// @ts-expect-error
				const { project } = session.getFileAndProject({
					file: fileName,
					projectFileName: undefined,
				}) as {
					file: ts.server.NormalizedPath;
					project: ts.server.Project;
				};
				const service = project2Service.get(project);
				if (!service) {
					throw new Error('No vue service for project: ' + project.getProjectName());
				}
				const [language, languageServiceHost, languageService] = service;
				return {
					typescript: ts,
					languageService,
					languageServiceHost,
					language,
				};
			}
		}
	},
);
