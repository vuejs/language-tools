import * as embedded from '@volar/language-core';
import { LanguageServerPlugin, Connection } from '@volar/language-server';
import * as vue from '@volar/vue-language-service';
import * as vue2 from '@volar/vue-language-core';
import * as nameCasing from '@volar/vue-language-service';
import { DetectNameCasingRequest, GetConvertAttrCasingEditsRequest, GetConvertTagCasingEditsRequest, ParseSFCRequest, GetVueCompilerOptionsRequest, GetComponentMeta } from './protocol';
import { VueServerInitializationOptions } from './types';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as meta from 'vue-component-meta';
import { resolveVueCompilerOptions, VueCompilerOptions } from '@volar/vue-language-core';

export function createServerPlugin(connection: Connection) {

	const plugin: LanguageServerPlugin = (initOptions: VueServerInitializationOptions): ReturnType<LanguageServerPlugin> => {

		const vueFileExtensions: string[] = ['vue'];
		const hostToVueOptions = new WeakMap<embedded.LanguageServiceHost, Partial<VueCompilerOptions>>();

		if (initOptions.petiteVue?.processHtmlFile) {
			vueFileExtensions.push('html');
		}

		if (initOptions.vitePress?.processMdFile) {
			vueFileExtensions.push('md');
		}

		if (initOptions.additionalExtensions) {
			for (const additionalExtension of initOptions.additionalExtensions) {
				vueFileExtensions.push(additionalExtension);
			}
		}

		return {
			extraFileExtensions: vueFileExtensions.map<ts.FileExtensionInfo>(ext => ({ extension: ext, isMixedContent: true, scriptKind: 7 })),
			watchFileExtensions: ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'jsx', 'tsx', 'json', ...vueFileExtensions],
			resolveConfig(config, modules, ctx) {

				const ts = modules.typescript;
				if (!ts) {
					return config;
				}

				const vueOptions = getVueCompilerOptions();
				const vueLanguageServiceSettings = getVueLanguageServiceSettings();

				if (ctx) {
					hostToVueOptions.set(ctx.host, vueOptions);
				}

				return vue.resolveConfig(
					config,
					ts,
					ctx?.host.getCompilationSettings() ?? {},
					vueOptions,
					vueLanguageServiceSettings,
				);

				function getVueCompilerOptions() {

					const ts = modules.typescript;
					if (!ts) {
						return {};
					}

					let vueOptions: Partial<vue.VueCompilerOptions> = {};

					if (typeof ctx?.project.tsConfig === 'string') {
						vueOptions = vue2.createParsedCommandLine(ts, ctx.sys, ctx.project.tsConfig, []).vueOptions;
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

				connection.onRequest(GetVueCompilerOptionsRequest.type, async params => {
					const languageService = await getService(params.uri);
					if (languageService) {
						return hostToVueOptions.get(languageService.context.host);
					}
				});

				connection.onRequest(DetectNameCasingRequest.type, async params => {
					const languageService = await getService(params.textDocument.uri);
					if (languageService?.context.typescript) {
						return nameCasing.detect(languageService.context, languageService.context.typescript, params.textDocument.uri);
					}
				});

				connection.onRequest(GetConvertTagCasingEditsRequest.type, async params => {
					const languageService = await getService(params.textDocument.uri);
					if (languageService?.context.typescript) {
						return nameCasing.convertTagName(languageService.context, languageService.context.typescript, params.textDocument.uri, params.casing);
					}
				});

				connection.onRequest(GetConvertAttrCasingEditsRequest.type, async params => {
					const languageService = await getService(params.textDocument.uri);
					if (languageService?.context.typescript) {
						const vueOptions = hostToVueOptions.get(languageService.context.host);
						if (vueOptions) {
							return nameCasing.convertAttrName(languageService.context, languageService.context.typescript, params.textDocument.uri, params.casing, resolveVueCompilerOptions(vueOptions));
						}
					}
				});

				const checkers = new WeakMap<embedded.LanguageServiceHost, meta.ComponentMetaChecker>();

				connection.onRequest(GetComponentMeta.type, async params => {

					const languageService = await getService(params.uri);
					if (!languageService?.context.typescript)
						return;

					let checker = checkers.get(languageService.context.host);
					if (!checker) {
						checker = meta.baseCreate(
							{
								...languageService.context.host,
								getVueCompilationSettings: () => hostToVueOptions.get(languageService.context.host) ?? {},
							},
							{},
							languageService.context.host.getCurrentDirectory() + '/tsconfig.json.global.vue',
							languageService.context.typescript.module,
						);
						checkers.set(languageService.context.host, checker);
					}
					return checker.getComponentMeta(env.uriToFileName(params.uri));
				});
			},
		};
	};

	return plugin;
}
