import * as embedded from '@volar/language-core';
import { LanguageServerPlugin } from '@volar/language-server';
import * as shared from '@volar/shared';
import * as vue from '@volar/vue-language-service';
import * as vue2 from '@volar/vue-language-core';
import * as nameCasing from '@volar/vue-language-service';
import { DetectNameCasingRequest, GetConvertAttrCasingEditsRequest, GetConvertTagCasingEditsRequest, ParseSFCRequest, GetVueCompilerOptionsRequest, GetComponentMeta } from './protocol';
import { VueServerInitializationOptions } from './types';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as meta from 'vue-component-meta';

const plugin: LanguageServerPlugin<VueServerInitializationOptions, vue.LanguageServiceHost> = (initOptions) => {

	const extraFileExtensions: ts.FileExtensionInfo[] = [{ extension: 'vue', isMixedContent: true, scriptKind: 7 }];

	if (initOptions.petiteVue?.processHtmlFile) {
		extraFileExtensions.push({ extension: 'html', isMixedContent: true, scriptKind: 7 });
	}

	if (initOptions.vitePress?.processMdFile) {
		extraFileExtensions.push({ extension: 'md', isMixedContent: true, scriptKind: 7 });
	}

	if (initOptions.additionalExtensions) {
		for (const additionalExtension of initOptions.additionalExtensions) {
			extraFileExtensions.push({ extension: additionalExtension, isMixedContent: true, scriptKind: 7 });
		}
	}

	return {
		extraFileExtensions,
		resolveLanguageServiceHost(ts, sys, tsConfig, host) {
			let vueOptions: vue.VueCompilerOptions = {};
			if (typeof tsConfig === 'string') {
				vueOptions = vue2.createParsedCommandLine(ts, sys, tsConfig, []).vueOptions;
			}
			vueOptions.extensions = getVueExts(vueOptions.extensions ?? ['.vue']);
			return {
				...host,
				getVueCompilationSettings: () => vueOptions,
			};
		},
		getLanguageModules(host) {
			const vueLanguageModules = vue2.createLanguageModules(
				host.getTypeScriptModule(),
				host.getCompilationSettings(),
				host.getVueCompilationSettings(),
			);
			return vueLanguageModules;
		},
		getServicePlugins(host, service) {
			const settings: vue.Settings = {};
			if (initOptions.json) {
				settings.json = { schemas: [] };
				for (const blockType in initOptions.json.customBlockSchemaUrls) {
					const url = initOptions.json.customBlockSchemaUrls[blockType];
					settings.json.schemas?.push({
						fileMatch: [`*.customBlock_${blockType}_*.json*`],
						uri: new URL(url, service.context.pluginContext.env.rootUri.toString() + '/').toString(),
					});
				}
			}
			return vue.getLanguageServicePlugins(host, service, settings);
		},
		onInitialize(connection, getService) {

			connection.onRequest(ParseSFCRequest.type, params => {
				return vue2.parse(params);
			});

			connection.onRequest(GetVueCompilerOptionsRequest.type, async params => {
				const languageService = await getService(params.uri);
				const host = languageService.context.host as vue.LanguageServiceHost;
				return host.getVueCompilationSettings?.();
			});

			connection.onRequest(DetectNameCasingRequest.type, async params => {
				const languageService = await getService(params.textDocument.uri);
				return nameCasing.detect(languageService.context, params.textDocument.uri);
			});

			connection.onRequest(GetConvertTagCasingEditsRequest.type, async params => {
				const languageService = await getService(params.textDocument.uri);
				return nameCasing.convertTagName(languageService.context, params.textDocument.uri, params.casing);
			});

			connection.onRequest(GetConvertAttrCasingEditsRequest.type, async params => {
				const languageService = await getService(params.textDocument.uri);
				return nameCasing.convertAttrName(languageService.context, params.textDocument.uri, params.casing);
			});

			const checkers = new WeakMap<embedded.LanguageServiceHost, meta.ComponentMetaChecker>();

			connection.onRequest(GetComponentMeta.type, async params => {
				const languageService = await getService(params.uri);
				let checker = checkers.get(languageService.context.host);
				if (!checker) {
					checker = meta.baseCreate(
						languageService.context.host as vue.LanguageServiceHost,
						{},
						languageService.context.host.getCurrentDirectory() + '/tsconfig.json.global.vue',
						languageService.context.pluginContext.typescript.module,
					);
					checkers.set(languageService.context.host, checker);
				}
				return checker.getComponentMeta(shared.getPathOfUri(params.uri));
			});
		},
	};

	function getVueExts(baseExts: string[]) {
		const set = new Set([
			...baseExts,
			...extraFileExtensions.map(ext => '.' + ext.extension),
		]);
		return [...set];
	}
};

export = plugin;
