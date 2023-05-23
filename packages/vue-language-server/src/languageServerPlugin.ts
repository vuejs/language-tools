import * as embedded from '@volar/language-core';
import { LanguageServerPlugin, Connection } from '@volar/language-server';
import * as vue from '@vue/language-service';
import * as vue2 from '@vue/language-core';
import * as nameCasing from '@vue/language-service';
import { DetectNameCasingRequest, GetConvertAttrCasingEditsRequest, GetConvertTagCasingEditsRequest, ParseSFCRequest, GetComponentMeta } from './protocol';
import { VueServerInitializationOptions } from './types';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as componentMeta from 'vue-component-meta';
import { VueCompilerOptions } from '@vue/language-core';

export function createServerPlugin(connection: Connection) {

	const plugin: LanguageServerPlugin = (initOptions: VueServerInitializationOptions, modules): ReturnType<LanguageServerPlugin> => {

		if (!modules.typescript) {
			console.warn('No typescript found, vue-language-server will not work.');
			return {};
		}

		const ts = modules.typescript;
		const vueFileExtensions: string[] = ['vue'];
		const hostToVueOptions = new WeakMap<embedded.LanguageServiceHost, Partial<VueCompilerOptions>>();

		if (initOptions.additionalExtensions) {
			for (const additionalExtension of initOptions.additionalExtensions) {
				vueFileExtensions.push(additionalExtension);
			}
		}

		return {
			extraFileExtensions: vueFileExtensions.map<ts.FileExtensionInfo>(ext => ({ extension: ext, isMixedContent: true, scriptKind: ts.ScriptKind.Deferred })),
			watchFileExtensions: ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'jsx', 'tsx', 'json', ...vueFileExtensions],
			resolveConfig(config, ctx) {

				const vueOptions = getVueCompilerOptions();
				const vueLanguageServiceSettings = getVueLanguageServiceSettings();

				if (ctx) {
					hostToVueOptions.set(ctx.host, vueOptions);
				}

				return vue.resolveConfig(
					config,
					ctx?.host.getCompilationSettings() ?? {},
					vueOptions,
					ts,
					vueLanguageServiceSettings,
					initOptions.codegenStack,
				);

				function getVueCompilerOptions() {

					const ts = modules.typescript;

					let vueOptions: Partial<vue.VueCompilerOptions>;

					if (typeof ctx?.project.tsConfig === 'string' && ts) {
						vueOptions = vue2.createParsedCommandLine(ts, ctx.sys, ctx.project.tsConfig).vueOptions;
					}
					else if (typeof ctx?.project.tsConfig === 'object' && ts) {
						vueOptions = vue2.createParsedCommandLineByJson(ts, ctx.sys, ctx.host.getCurrentDirectory(), ctx.project.tsConfig).vueOptions;
					}
					else {
						vueOptions = {};
					}

					vueOptions.extensions = [
						...vueOptions.extensions ?? ['.vue'],
						...vueFileExtensions.map(ext => '.' + ext),
					];
					vueOptions.extensions = [...new Set(vueOptions.extensions)];

					return vueOptions;
				}

				function getVueLanguageServiceSettings() {

					const settings: vue.Settings = {};

					if (initOptions.json && ctx) {
						settings.json = { schemas: [] };
						for (const blockType in initOptions.json.customBlockSchemaUrls) {
							const url = initOptions.json.customBlockSchemaUrls[blockType];
							settings.json.schemas?.push({
								fileMatch: [`*.customBlock_${blockType}_*.json*`],
								uri: new URL(url, ctx.project.rootUri.toString() + '/').toString(),
							});
						}
					}

					return settings;
				}
			},
			onInitialized(getService, env) {

				connection.onRequest(ParseSFCRequest.type, params => {
					return vue2.parse(params);
				});

				connection.onRequest(DetectNameCasingRequest.type, async params => {
					const languageService = await getService(params.textDocument.uri);
					if (languageService) {
						return nameCasing.detect(ts, languageService.context, params.textDocument.uri);
					}
				});

				connection.onRequest(GetConvertTagCasingEditsRequest.type, async params => {
					const languageService = await getService(params.textDocument.uri);
					if (languageService) {
						return nameCasing.convertTagName(ts, languageService.context, params.textDocument.uri, params.casing);
					}
				});

				connection.onRequest(GetConvertAttrCasingEditsRequest.type, async params => {
					const languageService = await getService(params.textDocument.uri);
					if (languageService) {
						const vueOptions = hostToVueOptions.get(languageService.context.core.host);
						if (vueOptions) {
							return nameCasing.convertAttrName(ts, languageService.context, params.textDocument.uri, params.casing);
						}
					}
				});

				const checkers = new WeakMap<embedded.LanguageServiceHost, componentMeta.ComponentMetaChecker>();

				connection.onRequest(GetComponentMeta.type, async params => {

					const languageService = await getService(params.uri);
					if (!languageService)
						return;

					let checker = checkers.get(languageService.context.core.host);
					if (!checker) {
						checker = componentMeta.baseCreate(
							languageService.context.core.host,
							hostToVueOptions.get(languageService.context.core.host)!,
							{},
							languageService.context.core.host.getCurrentDirectory() + '/tsconfig.json.global.vue',
							ts,
						);
						checkers.set(languageService.context.core.host, checker);
					}
					return checker.getComponentMeta(env.uriToFileName(params.uri));
				});
			},
		};
	};

	return plugin;
}
