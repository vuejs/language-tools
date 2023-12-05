import { Connection, ServerProject, TypeScriptServerPlugin } from '@volar/language-server';
import { createSys } from '@volar/typescript';
import * as vue2 from '@vue/language-core';
import { VueCompilerOptions } from '@vue/language-core';
import * as nameCasing from '@vue/language-service';
import * as vue from '@vue/language-service';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as componentMeta from 'vue-component-meta/out/base';
import { DetectNameCasingRequest, GetComponentMeta, GetConvertAttrCasingEditsRequest, GetConvertTagCasingEditsRequest, ParseSFCRequest } from './protocol';
import { VueServerInitializationOptions } from './types';

export function createServerPlugin(connection: Connection) {

	const plugin: TypeScriptServerPlugin = ({ initializationOptions, modules }): ReturnType<TypeScriptServerPlugin> => {

		if (!modules.typescript) {
			console.warn('No typescript found, vue-language-server will not work.');
			return {};
		}

		const options: VueServerInitializationOptions = initializationOptions;
		const ts = modules.typescript;
		const vueFileExtensions: string[] = ['vue'];
		const envToVueOptions = new WeakMap<vue.ServiceEnvironment, VueCompilerOptions>();

		if (options.additionalExtensions) {
			for (const additionalExtension of options.additionalExtensions) {
				vueFileExtensions.push(additionalExtension);
			}
		}

		return {
			extraFileExtensions: vueFileExtensions.map<ts.FileExtensionInfo>(ext => ({ extension: ext, isMixedContent: true, scriptKind: ts.ScriptKind.Deferred })),
			watchFileExtensions: ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'jsx', 'tsx', 'json', ...vueFileExtensions],
			async resolveConfig(config, env, info) {

				const vueOptions = await getVueCompilerOptions();

				if (env) {
					envToVueOptions.set(env, vue.resolveVueCompilerOptions(vueOptions));
				}

				config.languages = vue.resolveLanguages(ts, config.languages ?? {}, info?.parsedCommandLine.options ?? {}, vueOptions, options.codegenStack);
				config.services = vue.resolveServices(ts, config.services ?? {}, vueOptions);

				return config;

				async function getVueCompilerOptions() {

					let vueOptions: Partial<vue.VueCompilerOptions> = {};

					if (env && info) {
						const sys = createSys(ts, env, env.uriToFileName(env.workspaceFolder.uri.toString()));
						let sysVersion: number | undefined;
						let newSysVersion = await sys.sync();

						while (sysVersion !== newSysVersion) {
							sysVersion = newSysVersion;
							if (info.configFileName) {
								vueOptions = vue2.createParsedCommandLine(ts, sys, info.configFileName).vueOptions;
							}
							else {
								vueOptions = vue2.createParsedCommandLineByJson(ts, sys, env.uriToFileName(env.workspaceFolder.uri.toString()), info.parsedCommandLine.options).vueOptions;
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
			onInitialized(projects) {

				connection.onRequest(ParseSFCRequest.type, params => {
					return vue2.parse(params);
				});

				connection.onRequest(DetectNameCasingRequest.type, async params => {
					const languageService = await getService(params.textDocument.uri);
					if (languageService) {
						return nameCasing.detect(ts, languageService.context, params.textDocument.uri, envToVueOptions.get(languageService.context.env)!);
					}
				});

				connection.onRequest(GetConvertTagCasingEditsRequest.type, async params => {
					const languageService = await getService(params.textDocument.uri);
					if (languageService) {
						return nameCasing.convertTagName(ts, languageService.context, params.textDocument.uri, params.casing, envToVueOptions.get(languageService.context.env)!);
					}
				});

				connection.onRequest(GetConvertAttrCasingEditsRequest.type, async params => {
					const languageService = await getService(params.textDocument.uri);
					if (languageService) {
						const vueOptions = envToVueOptions.get(languageService.context.env);
						if (vueOptions) {
							return nameCasing.convertAttrName(ts, languageService.context, params.textDocument.uri, params.casing, envToVueOptions.get(languageService.context.env)!);
						}
					}
				});

				const checkers = new WeakMap<ServerProject, componentMeta.ComponentMetaChecker>();

				connection.onRequest(GetComponentMeta.type, async params => {

					const project = await projects.getProject(params.uri);
					const langaugeService = project.getLanguageService();

					let checker = checkers.get(project);
					if (!checker) {
						checker = componentMeta.baseCreate(
							ts,
							langaugeService.context.language.typescript!.configFileName,
							langaugeService.context.language.typescript!.projectHost,
							envToVueOptions.get(langaugeService.context.env)!,
							{},
							langaugeService.context.language.typescript!.languageServiceHost.getCurrentDirectory() + '/tsconfig.json.global.vue',
						);
						checkers.set(project, checker);
					}
					return checker?.getComponentMeta(langaugeService.context.env.uriToFileName(params.uri));
				});

				async function getService(uri: string) {
					return (await projects.getProject(uri)).getLanguageService();
				}
			},
		};
	};

	return plugin;
}
