import * as embedded from '@volar/language-core';
import { LanguageServerPlugin } from '@volar/language-server';
import * as shared from '@volar/shared';
import * as vue from '@volar/vue-language-service';
import * as nameCasing from '@volar/vue-language-service/out/ideFeatures/nameCasing';
import { DetectTagCasingRequest, GetConvertTagCasingEditsRequest } from './requests';

const plugin: LanguageServerPlugin<vue.LanguageServiceHost> = {
	extensions: ['.vue'],
	// indeterminateExts: ['.md', '.html'],
	languageService: {
		semanticTokenLegend: vue.getSemanticTokenLegend(),
		resolveLanguageServiceHost(ts, sys, tsConfig, host) {
			let vueOptions: vue.VueCompilerOptions = {};
			if (typeof tsConfig === 'string') {
				vueOptions = vue.createParsedCommandLine(ts, sys, tsConfig).vueOptions;
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
			);
			return [vueLanguageModule];
		},
		getServicePlugins(host, service) {
			return vue.getLanguageServicePlugins(host, service);
		},
		onInitialize(connection, getService) {

			connection.onRequest(DetectTagCasingRequest.type, async params => {
				const languageService = await getService(params.textDocument.uri);
				return nameCasing.detect(languageService.context, params.textDocument.uri);
			});

			connection.onRequest(GetConvertTagCasingEditsRequest.type, async params => {
				const languageService = await getService(params.textDocument.uri);
				return nameCasing.convert(languageService.context, languageService.findReferences, params.textDocument.uri, params.casing);
			});
		},
	},
	documentService: {
		getLanguageModules(ts, env) {
			const vueLanguagePlugins = vue.getDefaultVueLanguagePlugins(ts, shared.getPathOfUri(env.rootUri.toString()), {}, {}, []);
			const vueLanguageModule: embedded.EmbeddedLanguageModule = {
				createSourceFile(fileName, snapshot) {
					if (fileName.endsWith('.vue')) {
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

export = plugin;
