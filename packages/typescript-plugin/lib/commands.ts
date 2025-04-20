import { FileMap, VueVirtualCode, type IScriptSnapshot, type Language } from '@vue/language-core';
import type * as ts from 'typescript';
import { collectExtractProps } from './requests/collectExtractProps';
import { getComponentDirectives } from './requests/getComponentDirectives';
import { getComponentEvents } from './requests/getComponentEvents';
import { getComponentNames } from './requests/getComponentNames';
import { getComponentProps } from './requests/getComponentProps';
import { getElementAttrs } from './requests/getElementAttrs';
import { getElementNames } from './requests/getElementNames';
import { getImportPathForFile } from './requests/getImportPathForFile';
import { getPropertiesAtLocation } from './requests/getPropertiesAtLocation';
import type { RequestContext } from './requests/types';

// https://github.com/JetBrains/intellij-plugins/blob/6435723ad88fa296b41144162ebe3b8513f4949b/Angular/src-js/angular-service/src/index.ts#L69
export function addVueCommands(
	ts: typeof import('typescript'),
	info: ts.server.PluginCreateInfo,
	project2Service: Map<ts.server.Project, [Language, ts.LanguageServiceHost, ts.LanguageService]>
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

	interface ScriptInfo {
		version: string;
		snapshot?: IScriptSnapshot;
	}

	const isCaseSensitive = info.languageServiceHost.useCaseSensitiveFileNames?.() ?? false;
	let lastProjectVersion: string | undefined;
	let scriptInfos = new FileMap<ScriptInfo>(isCaseSensitive);

	session.addProtocolHandler('vue:isProjectUpdated', () => {
		const projectVersion = info.project.getProjectVersion();
		if (projectVersion === lastProjectVersion) {
			return { response: 'no' };
		}
		lastProjectVersion = projectVersion;

		let shouldUpdate = false;
		const [, [language, languageServiceHost]] = [...project2Service].find(
			([project]) => project.projectKind === ts.server.ProjectKind.Configured
		)!;

		const fileNames = languageServiceHost.getScriptFileNames();
		const infos = new FileMap<ScriptInfo>(isCaseSensitive);

		for (const file of fileNames) {
			let scriptVersion = languageServiceHost.getScriptVersion(file);

			const scriptInfo = scriptInfos.get(file) ?? { version: "" };
			infos.set(file, scriptInfo);
			if (scriptInfo.version === scriptVersion) {
				continue;
			}
			scriptInfo.version = scriptVersion;

			const volarFile = language.scripts.get(file);
			if (!volarFile?.generated) {
				continue;
			}

			const root = volarFile.generated.root;
			if (!(root instanceof VueVirtualCode)) {
				continue;
			}

			const serviceScript = volarFile.generated.languagePlugin.typescript?.getServiceScript(root);
			if (!serviceScript) {
				continue;
			}

			const { snapshot } = serviceScript.code;
			if (scriptInfo.snapshot === snapshot) {
				continue;
			}
			scriptInfo.snapshot = snapshot;
			shouldUpdate = true;
		}
		scriptInfos = infos;

		return { response: shouldUpdate ? 'yes' : 'no' };
	});
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
			response: getComponentNames.apply(getRequestContext(args[0]), args),
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
