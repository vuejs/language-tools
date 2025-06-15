import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin';
import * as vue from '@vue/language-core';
import type * as ts from 'typescript';
import { createVueLanguageServiceProxy } from './lib/common';
import { collectExtractProps } from './lib/requests/collectExtractProps';
import { getComponentDirectives } from './lib/requests/getComponentDirectives';
import { getComponentEvents } from './lib/requests/getComponentEvents';
import { getComponentNames } from './lib/requests/getComponentNames';
import { getComponentProps } from './lib/requests/getComponentProps';
import { getElementAttrs } from './lib/requests/getElementAttrs';
import { getElementNames } from './lib/requests/getElementNames';
import { getImportPathForFile } from './lib/requests/getImportPathForFile';
import { getPropertiesAtLocation } from './lib/requests/getPropertiesAtLocation';
import type { RequestContext } from './lib/requests/types';

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

		addVueCommands();

		return {
			languagePlugins: [languagePlugin],
			setup: language => {
				project2Service.set(info.project, [language, info.languageServiceHost, info.languageService]);

				info.languageService = createVueLanguageServiceProxy(ts, language, info.languageService, vueOptions, fileName => fileName);

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
				return vue.createParsedCommandLineByJson(ts, ts.sys, info.languageServiceHost.getCurrentDirectory(), {}).vueOptions;
			}
		}

		// https://github.com/JetBrains/intellij-plugins/blob/6435723ad88fa296b41144162ebe3b8513f4949b/Angular/src-js/angular-service/src/index.ts#L69
		function addVueCommands() {
			const projectService = info.project.projectService;
			projectService.logger.info("Vue: called handler processing " + info.project.projectKind);

			const session = info.session;
			if (session == undefined) {
				projectService.logger.info("Vue: there is no session in info.");
				return;
			}
			if (session.addProtocolHandler == undefined) {
				// addProtocolHandler was introduced in TS 4.4 or 4.5 in 2021, see https://github.com/microsoft/TypeScript/issues/43893
				projectService.logger.info("Vue: there is no addProtocolHandler method.");
				return;
			}
			if ((session as any).vueCommandsAdded) {
				return;
			}

			(session as any).vueCommandsAdded = true;

			session.addProtocolHandler('vue:collectExtractProps', ({ arguments: args }) => {
				return {
					response: collectExtractProps.apply(getRequestContext(args[0]), args),
				};
			});
			session.addProtocolHandler('vue:getImportPathForFile', ({ arguments: args }) => {
				return {
					response: getImportPathForFile.apply(getRequestContext(args[0]), args),
				};
			});
			session.addProtocolHandler('vue:getPropertiesAtLocation', ({ arguments: args }) => {
				return {
					response: getPropertiesAtLocation.apply(getRequestContext(args[0]), args),
				};
			});
			session.addProtocolHandler('vue:getComponentNames', ({ arguments: args }) => {
				return {
					response: getComponentNames.apply(getRequestContext(args[0]), args) ?? [],
				};
			});
			session.addProtocolHandler('vue:getComponentProps', ({ arguments: args }) => {
				return {
					response: getComponentProps.apply(getRequestContext(args[0]), args),
				};
			});
			session.addProtocolHandler('vue:getComponentEvents', ({ arguments: args }) => {
				return {
					response: getComponentEvents.apply(getRequestContext(args[0]), args),
				};
			});
			session.addProtocolHandler('vue:getComponentDirectives', ({ arguments: args }) => {
				return {
					response: getComponentDirectives.apply(getRequestContext(args[0]), args),
				};
			});
			session.addProtocolHandler('vue:getElementAttrs', ({ arguments: args }) => {
				return {
					response: getElementAttrs.apply(getRequestContext(args[0]), args),
				};
			});
			session.addProtocolHandler('vue:getElementNames', ({ arguments: args }) => {
				return {
					response: getElementNames.apply(getRequestContext(args[0]), args),
				};
			});

			projectService.logger.info('Vue specific commands are successfully added.');
		}

		function getRequestContext(fileName: string): RequestContext {
			const fileAndProject = (info.session as any).getFileAndProject({
				file: fileName,
				projectFileName: undefined,
			}) as {
				file: ts.server.NormalizedPath;
				project: ts.server.Project;
			};
			const service = project2Service.get(fileAndProject.project);
			if (!service) {
				throw 'No RequestContext';
			}
			return {
				typescript: ts,
				languageService: service[2],
				languageServiceHost: service[1],
				language: service[0],
				isTsPlugin: true,
				asScriptId: (fileName: string) => fileName,
			};
		}
	}
);
