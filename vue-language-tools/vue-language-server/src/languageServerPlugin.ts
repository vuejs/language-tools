import * as embedded from '@volar/language-core';
import { LanguageServerPlugin, Connection } from '@volar/language-server';
import * as shared from '@volar/shared';
import * as vue from '@volar/vue-language-service';
import * as vue2 from '@volar/vue-language-core';
import * as nameCasing from '@volar/vue-language-service';
import { DetectNameCasingRequest, GetConvertAttrCasingEditsRequest, GetConvertTagCasingEditsRequest, ParseSFCRequest, GetVueCompilerOptionsRequest, GetComponentMeta } from './protocol';
import { VueServerInitializationOptions } from './types';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as meta from 'vue-component-meta';

export function createServerPlugin(connection: Connection) {

	const plugin: LanguageServerPlugin<VueServerInitializationOptions, vue.VueLanguageServiceHost> = (initOptions) => {

		const vueFileExtensions: string[] = ['vue'];

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
			tsconfigExtraFileExtensions: vueFileExtensions.map<ts.FileExtensionInfo>(ext => ({ extension: ext, isMixedContent: true, scriptKind: 7 })),
			diagnosticDocumentSelector: [
				{ language: 'javascript' },
				{ language: 'typescript' },
				{ language: 'javascriptreact' },
				{ language: 'typescriptreact' },
				{ language: 'vue' },
			],
			extensions: {
				fileRenameOperationFilter:
					['js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'jsx', 'tsx', 'json', ...vueFileExtensions],
				fileWatcher:
					['js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'jsx', 'tsx', 'json', ...vueFileExtensions],
			},
			resolveLanguageServiceHost(ts, sys, tsConfig, host) {
				let vueOptions: Partial<vue.VueCompilerOptions> = {};
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
				const ts = host.getTypeScriptModule?.();
				if (ts) {
					const vueLanguageModules = vue2.createLanguageModules(
						ts,
						host.getCompilationSettings(),
						vue2.resolveVueCompilerOptions(host.getVueCompilationSettings()),
					);
					return vueLanguageModules;
				}
				return [];
			},
			getLanguageServicePlugins(host, context) {
				const settings: vue.Settings = {};
				if (initOptions.json) {
					settings.json = { schemas: [] };
					for (const blockType in initOptions.json.customBlockSchemaUrls) {
						const url = initOptions.json.customBlockSchemaUrls[blockType];
						settings.json.schemas?.push({
							fileMatch: [`*.customBlock_${blockType}_*.json*`],
							uri: new URL(url, context.env.rootUri.toString() + '/').toString(),
						});
					}
				}
				return vue.getLanguageServicePlugins(vue2.resolveVueCompilerOptions(host.getVueCompilationSettings()), settings);
			},
			onInitialize(initResult) {
				if (initResult.capabilities.completionProvider?.triggerCharacters) {
					const triggerCharacters = new Set([
						'/', '-', ':', // css
						...'>+^*()#.[]$@-{}'.split(''), // emmet
						'.', ':', '<', '"', '=', '/', // html, vue
						'@', // vue-event
						'"', ':', // json
						'.', '"', '\'', '`', '/', '<', '@', '#', ' ', // typescript
						'*', // typescript-jsdoc
						'@', // typescript-comment
					]);
					initResult.capabilities.completionProvider.triggerCharacters = initResult.capabilities.completionProvider.triggerCharacters.filter(c => triggerCharacters.has(c));
				}
			},
			onInitialized(getService) {

				connection.onRequest(ParseSFCRequest.type, params => {
					return vue2.parse(params);
				});

				connection.onRequest(GetVueCompilerOptionsRequest.type, async params => {
					const languageService = await getService(params.uri);
					const host = languageService.context.host as vue.VueLanguageServiceHost;
					return host.getVueCompilationSettings?.();
				});

				connection.onRequest(DetectNameCasingRequest.type, async params => {
					const languageService = await getService(params.textDocument.uri);
					if (languageService.context.typescript) {
						return nameCasing.detect(languageService.context, languageService.context.typescript, params.textDocument.uri);
					}
				});

				connection.onRequest(GetConvertTagCasingEditsRequest.type, async params => {
					const languageService = await getService(params.textDocument.uri);
					if (languageService.context.typescript) {
						return nameCasing.convertTagName(languageService.context, languageService.context.typescript, params.textDocument.uri, params.casing);
					}
				});

				connection.onRequest(GetConvertAttrCasingEditsRequest.type, async params => {
					const languageService = await getService(params.textDocument.uri);
					if (languageService.context.typescript) {
						return nameCasing.convertAttrName(languageService.context, languageService.context.typescript, params.textDocument.uri, params.casing);
					}
				});

				const checkers = new WeakMap<embedded.LanguageServiceHost, meta.ComponentMetaChecker>();

				connection.onRequest(GetComponentMeta.type, async params => {

					const languageService = await getService(params.uri);
					if (!languageService.context.typescript)
						return;

					let checker = checkers.get(languageService.context.host);
					if (!checker) {
						checker = meta.baseCreate(
							languageService.context.host as vue.VueLanguageServiceHost,
							{},
							languageService.context.host.getCurrentDirectory() + '/tsconfig.json.global.vue',
							languageService.context.typescript.module,
						);
						checkers.set(languageService.context.host, checker);
					}
					return checker.getComponentMeta(shared.uriToFileName(params.uri));
				});
			},
		};

		function getVueExts(baseExts: string[]) {
			const set = new Set([
				...baseExts,
				...vueFileExtensions.map(ext => '.' + ext),
			]);
			return [...set];
		}
	};

	return plugin;
}
