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
import type { VueCompilerOptions } from '@volar/vue-language-core';

export function createServerPlugin(connection: Connection) {

	const plugin: LanguageServerPlugin<VueServerInitializationOptions> = (initOptions) => {

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
			resolveConfig(config, ctx) {

				const ts = ctx.project.workspace.workspaces.ts;
				if (!ts) {
					return;
				}

				const settings: vue.Settings = {};

				if (initOptions.json) {
					settings.json = { schemas: [] };
					for (const blockType in initOptions.json.customBlockSchemaUrls) {
						const url = initOptions.json.customBlockSchemaUrls[blockType];
						settings.json.schemas?.push({
							fileMatch: [`*.customBlock_${blockType}_*.json*`],
							uri: new URL(url, ctx.project.rootUri.toString() + '/').toString(),
						});
					}
				}

				let vueOptions: Partial<vue.VueCompilerOptions> = {};
				if (typeof ctx.project.tsConfig === 'string') {
					vueOptions = vue2.createParsedCommandLine(ts, ctx.sys, ctx.project.tsConfig, []).vueOptions;
				}
				vueOptions.extensions = getVueExts(vueOptions.extensions);

				hostToVueOptions.set(ctx.host, vueOptions);

				vue.createConfig(config, ts, ctx.host.getCompilationSettings(), vueOptions, settings);
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
					return hostToVueOptions.get(languageService.context.host);
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

		function getVueExts(baseExts: string[] | undefined) {
			const set = new Set([
				...baseExts ?? ['.vue'],
				...vueFileExtensions.map(ext => '.' + ext),
			]);
			return [...set];
		}
	};

	return plugin;
}
