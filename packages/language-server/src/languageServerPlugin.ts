import * as embedded from '@volar/language-core';
import { LanguageServerPlugin, Connection } from '@volar/language-server';
import * as vue from '@vue/language-service';
import * as vue2 from '@vue/language-core';
import * as nameCasing from '@vue/language-service';
import { DetectNameCasingRequest, GetConvertAttrCasingEditsRequest, GetConvertTagCasingEditsRequest, ParseSFCRequest, GetComponentMeta, GetDragAndDragImportEditsRequest } from './protocol';
import { VueServerInitializationOptions } from './types';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as componentMeta from 'vue-component-meta/out/base';
import { VueCompilerOptions } from '@vue/language-core';
import { createSys } from '@volar/typescript';

export function createServerPlugin(connection: Connection) {

	const plugin: LanguageServerPlugin = (initOptions: VueServerInitializationOptions, modules): ReturnType<LanguageServerPlugin> => {

		if (!modules.typescript) {
			console.warn('No typescript found, vue-language-server will not work.');
			return {};
		}

		const ts = modules.typescript;
		const vueFileExtensions: string[] = ['vue'];
		const hostToVueOptions = new WeakMap<embedded.TypeScriptLanguageHost, VueCompilerOptions>();

		if (initOptions.additionalExtensions) {
			for (const additionalExtension of initOptions.additionalExtensions) {
				vueFileExtensions.push(additionalExtension);
			}
		}

		return {
			extraFileExtensions: vueFileExtensions.map<ts.FileExtensionInfo>(ext => ({ extension: ext, isMixedContent: true, scriptKind: ts.ScriptKind.Deferred })),
			watchFileExtensions: ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'jsx', 'tsx', 'json', ...vueFileExtensions],
			async resolveConfig(config, ctx) {

				const vueOptions = await getVueCompilerOptions();

				if (ctx) {
					hostToVueOptions.set(ctx.host, vue.resolveVueCompilerOptions(vueOptions));
				}

				return vue.resolveConfig(
					ts,
					config,
					ctx?.host.getCompilationSettings() ?? {},
					vueOptions,
					initOptions.codegenStack,
				);

				async function getVueCompilerOptions() {

					const ts = modules.typescript;

					let vueOptions: Partial<vue.VueCompilerOptions> = {};

					if (ts && ctx) {
						const sys = createSys(ts, ctx.env);
						let sysVersion: number | undefined;
						let newSysVersion = await sys.sync();

						while (sysVersion !== newSysVersion) {
							sysVersion = newSysVersion;
							if (typeof ctx?.project.tsConfig === 'string' && ts) {
								vueOptions = vue2.createParsedCommandLine(ts, sys, ctx.project.tsConfig).vueOptions;
							}
							else if (typeof ctx?.project.tsConfig === 'object' && ts) {
								vueOptions = vue2.createParsedCommandLineByJson(ts, sys, ctx.host.rootPath, ctx.project.tsConfig).vueOptions;
							}
							newSysVersion = await sys.sync();
						}
					}

					vueOptions.extensions = [
						...vueOptions.extensions ?? ['.vue'],
						...vueFileExtensions.map(ext => '.' + ext),
					];
					vueOptions.extensions = [...new Set(vueOptions.extensions)];

					return vueOptions;
				}
			},
			onInitialized(getService, env) {

				connection.onRequest(ParseSFCRequest.type, params => {
					return vue2.parse(params);
				});

				connection.onRequest(DetectNameCasingRequest.type, async params => {
					const languageService = await getService(params.textDocument.uri);
					if (languageService) {
						return nameCasing.detect(ts, languageService.context, params.textDocument.uri, hostToVueOptions.get(languageService.context.rawHost)!);
					}
				});

				connection.onRequest(GetConvertTagCasingEditsRequest.type, async params => {
					const languageService = await getService(params.textDocument.uri);
					if (languageService) {
						return nameCasing.convertTagName(ts, languageService.context, params.textDocument.uri, params.casing, hostToVueOptions.get(languageService.context.rawHost)!);
					}
				});

				connection.onRequest(GetDragAndDragImportEditsRequest.type, async params => {
					const languageService = await getService(params.uri);
					if (languageService) {
						return nameCasing.getDragImportEdits(ts, languageService.context, params.uri, params.importUri, params.casing);
					}
				});

				connection.onRequest(GetConvertAttrCasingEditsRequest.type, async params => {
					const languageService = await getService(params.textDocument.uri);
					if (languageService) {
						const vueOptions = hostToVueOptions.get(languageService.context.host);
						if (vueOptions) {
							return nameCasing.convertAttrName(ts, languageService.context, params.textDocument.uri, params.casing, hostToVueOptions.get(languageService.context.rawHost)!);
						}
					}
				});

				const checkers = new WeakMap<embedded.TypeScriptLanguageHost, componentMeta.Checker>();

				connection.onRequest(GetComponentMeta.type, async params => {

					const languageService = await getService(params.uri);
					if (!languageService)
						return;

					const host = languageService.context.rawHost;

					let checker = checkers.get(host);
					if (!checker) {
						checker = componentMeta.baseCreate(
							ts,
							host,
							hostToVueOptions.get(host)!,
							{},
							host.rootPath + '/tsconfig.json.global.vue',
						);
						checkers.set(host, checker);
					}
					return checker.getComponentMeta(env.uriToFileName(params.uri));
				});
			},
		};
	};

	return plugin;
}
