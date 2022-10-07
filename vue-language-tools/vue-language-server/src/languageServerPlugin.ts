import * as embedded from '@volar/language-core';
import { LanguageServerPlugin } from '@volar/language-server';
import * as shared from '@volar/shared';
import * as vue from '@volar/vue-language-service';
import * as vue2 from '@volar/vue-language-core';
import * as nameCasing from '@volar/vue-language-service';
import { DetectNameCasingRequest, GetConvertAttrCasingEditsRequest, GetConvertTagCasingEditsRequest, ParseSFCRequest } from './protocol';
import { VueServerInitializationOptions } from './types';
import type * as ts from 'typescript/lib/tsserverlibrary';

const plugin: LanguageServerPlugin<VueServerInitializationOptions, vue.LanguageServiceHost> = (initOptions) => {

	const extraFileExtensions: ts.FileExtensionInfo[] = [{ extension: 'vue', isMixedContent: true, scriptKind: 7 }];

	if (initOptions.petiteVue?.processHtmlFile) {
		extraFileExtensions.push({ extension: 'html', isMixedContent: true, scriptKind: 7 });
	}

	if (initOptions.vitePress?.processMdFile) {
		extraFileExtensions.push({ extension: 'md', isMixedContent: true, scriptKind: 7 });
	}

	const exts = extraFileExtensions.map(ext => '.' + ext.extension);

	return {
		extraFileExtensions,
		semanticService: {
			semanticTokenLegend: vue.getSemanticTokenLegend(),
			resolveLanguageServiceHost(ts, sys, tsConfig, host) {
				let vueOptions: vue.VueCompilerOptions = {};
				if (typeof tsConfig === 'string') {
					vueOptions = vue2.createParsedCommandLine(ts, sys, tsConfig, []).vueOptions;
				}
				return {
					...host,
					getVueCompilationSettings: () => vueOptions,
				};
			},
			getLanguageModules(host) {
				const vueLanguageModule = vue2.createLanguageModule(
					host.getTypeScriptModule(),
					host.getCurrentDirectory(),
					host.getCompilationSettings(),
					host.getVueCompilationSettings(),
					exts,
				);
				return [vueLanguageModule];
			},
			getServicePlugins(host, service) {
				return vue.getLanguageServicePlugins(host, service);
			},
			onInitialize(connection, getService) {

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
			},
		},
		syntacticService: {
			getLanguageModules(ts, env) {
				const vueLanguagePlugins = vue2.getDefaultVueLanguagePlugins(ts, shared.getPathOfUri(env.rootUri.toString()), {}, {}, []);
				const vueLanguageModule: embedded.LanguageModule = {
					createSourceFile(fileName, snapshot) {
						if (exts.some(ext => fileName.endsWith(ext))) {
							return new vue2.VueSourceFile(fileName, snapshot, ts, vueLanguagePlugins);
						}
					},
					updateSourceFile(sourceFile: vue2.VueSourceFile, snapshot) {
						sourceFile.update(snapshot);
					},
				};
				return [vueLanguageModule];
			},
			getServicePlugins(context) {
				return vue.getDocumentServicePlugins(context);
			},
			onInitialize(connection) {
				connection.onRequest(ParseSFCRequest.type, params => {
					return vue2.parse(params);
				});
			},
		},
	};
};

export = plugin;
