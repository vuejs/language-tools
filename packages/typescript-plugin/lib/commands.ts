import { FileMap } from '@vue/language-core';
import { camelize, capitalize } from '@vue/shared';
import type * as ts from 'typescript';
import { collectExtractProps } from './requests/collectExtractProps';
import { getComponentDirectives } from './requests/getComponentDirectives';
import { getComponentEvents } from './requests/getComponentEvents';
import { getComponentNames } from './requests/getComponentNames';
import { ComponentPropInfo, getComponentProps } from './requests/getComponentProps';
import { getElementAttrs } from './requests/getElementAttrs';
import { getElementNames } from './requests/getElementNames';
import { getImportPathForFile } from './requests/getImportPathForFile';
import { getPropertiesAtLocation } from './requests/getPropertiesAtLocation';
import type { RequestContext } from './requests/types';

// https://github.com/JetBrains/intellij-plugins/blob/6435723ad88fa296b41144162ebe3b8513f4949b/Angular/src-js/angular-service/src/index.ts#L69
export function addVueCommands(
	ts: typeof import('typescript'),
	info: ts.server.PluginCreateInfo,
	project2Service: WeakMap<ts.server.Project, [any, ts.LanguageServiceHost, ts.LanguageService]>
) {
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

	let lastProjectVersion: string | undefined;
	const componentInfos = new FileMap<[
		componentNames: string[],
		componentProps: Record<string, ComponentPropInfo[]>,
	]>(false);

	listenComponentInfos();

	async function listenComponentInfos() {
		while (true) {
			await sleep(500);
			const projectVersion = info.project.getProjectVersion();
			if (lastProjectVersion === projectVersion) {
				continue;
			}

			const openedScriptInfos = info.project.getRootScriptInfos().filter(info => info.isScriptOpen());
			if (!openedScriptInfos.length) {
				continue;
			}

			const requestContexts = new Map<string, RequestContext>();
			const token = info.languageServiceHost.getCancellationToken?.();

			for (const scriptInfo of openedScriptInfos) {
				await sleep(10);
				if (token?.isCancellationRequested()) {
					break;
				}

				let requestContext = requestContexts.get(scriptInfo.fileName);
				if (!requestContext) {
					requestContexts.set(
						scriptInfo.fileName,
						requestContext = getRequestContext(scriptInfo.fileName)
					);
				}

				const data = getComponentInfo(scriptInfo.fileName);
				const [oldComponentNames, componentProps] = data;
				const newComponentNames = getComponentNames.apply(requestContext, [scriptInfo.fileName]) ?? [];

				if (JSON.stringify(oldComponentNames) !== JSON.stringify(newComponentNames)) {
					data[0] = newComponentNames;
				}

				for (const [name, props] of Object.entries(componentProps)) {
					await sleep(10);
					if (token?.isCancellationRequested()) {
						break;
					}

					const newProps = getComponentProps.apply(requestContext, [scriptInfo.fileName, name]) ?? [];
					if (JSON.stringify(props) !== JSON.stringify(newProps)) {
						componentProps[name] = newProps;
					}
				}
			}
			lastProjectVersion = projectVersion;
		}
	}

	function getComponentInfo(fileName: string) {
		let data = componentInfos.get(fileName);
		if (!data) {
			componentInfos.set(fileName, data = [[], {}]);
		}
		return data;
	}

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
	session.addProtocolHandler('vue:getComponentNames', ({ arguments: [fileName] }) => {
		return {
			response: getComponentInfo(fileName)[0],
		};
	});
	session.addProtocolHandler('vue:getComponentProps', ({ arguments: [fileName, tag] }) => {
		const [, componentProps] = getComponentInfo(fileName);
		let response = componentProps[tag]
			?? componentProps[camelize(tag)]
			?? componentProps[capitalize(camelize(tag))];

		if (!response) {
			const requestContext = getRequestContext(fileName);
			const props = getComponentProps.apply(requestContext, [fileName, tag]) ?? [];
			response = componentProps[tag] = props;
		}
		return { response };
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
			getFileId: (fileName: string) => fileName,
		};
	}
}

function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
