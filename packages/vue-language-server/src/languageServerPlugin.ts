import * as embedded from '@volar/language-core';
import { LanguageServerPlugin } from '@volar/language-server';
import * as shared from '@volar/shared';
import * as vue from '@volar/vue-language-service';
import * as nameCasing from '@volar/vue-language-service';
import { DetectNameCasingRequest, GetConvertAttrCasingEditsRequest, GetConvertTagCasingEditsRequest } from './protocol';
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
		languageService: {
			semanticTokenLegend: vue.getSemanticTokenLegend(),
			resolveLanguageServiceHost(ts, sys, tsConfig, host) {
				let vueOptions: vue.VueCompilerOptions = {};
				if (typeof tsConfig === 'string') {
					vueOptions = vue.createParsedCommandLine(ts, sys, tsConfig, []).vueOptions;
				}
				return {
					...host,
					getVueCompilationSettings: () => vueOptions,
				};
			},
			getLanguageModules(host) {
				const vueLanguageModule = vue.createEmbeddedLanguageModule(
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
		documentService: {
			getLanguageModules(ts, env) {
				const vueLanguagePlugins = vue.getDefaultVueLanguagePlugins(ts, shared.getPathOfUri(env.rootUri.toString()), {}, {}, []);
				const vueLanguageModule: embedded.EmbeddedLanguageModule = {
					createSourceFile(fileName, snapshot) {
						if (exts.some(ext => fileName.endsWith(ext))) {
							return new vue.VueSourceFile(fileName, snapshot, ts, vueLanguagePlugins);
						}
					},
					updateSourceFile(sourceFile: vue.VueSourceFile, snapshot) {
						sourceFile.update(snapshot);
					},
				};
				return [vueLanguageModule];
			},
			getServicePlugins(context) {
				return vue.getDocumentServicePlugins(context);
			},
		},
	};
};

export = plugin;
