import { LanguageServerPlugin } from '@volar/embedded-language-server';
import * as vue from '@volar/vue-language-service';
import { DetectTagCasingRequest, GetConvertTagCasingEditsRequest } from './requests';
import * as nameCasing from '@volar/vue-language-service/out/ideFeatures/nameCasing';
import * as embedded from '@volar/embedded-language-core';
import * as shared from '@volar/shared';

export const languageConfigs: LanguageServerPlugin<vue.LanguageServiceHost> = {
	exts: ['.vue'],
	// indeterminateExts: ['.md', '.html'],
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
	languageService: {
		getLanguageModules(host) {
			const vueLanguageModule = vue.createEmbeddedLanguageModule(
				host.getTypeScriptModule(),
				host.getCurrentDirectory(),
				host.getCompilationSettings(),
				host.getVueCompilationSettings(),
			);
			return [vueLanguageModule];
		},
		getLanguageServicePlugins(host, service) {
			return vue.getLanguageServicePlugins(host, service);
		},
	},
	documentService: {
		getLanguageModules(ts, env) {
			const vueLanguagePlugins = vue.getDefaultVueLanguagePlugins(ts, shared.getPathOfUri(env.rootUri.toString()), {}, {}, []);
			const vueLanguageModule: embedded.EmbeddedLanguageModule = {
				createSourceFile(fileName, snapshot) {
					return new vue.VueSourceFile(fileName, snapshot, ts, vueLanguagePlugins);
				},
				updateSourceFile(sourceFile: vue.VueSourceFile, snapshot) {
					sourceFile.update(snapshot);
				},
			};
			return [vueLanguageModule];
		},
		getLanguageServicePlugins(context) {
			return vue.getDocumentServicePlugins(context);
		},
	},
	handleLanguageFeature: (connection, getService) => {

		connection.onRequest(DetectTagCasingRequest.type, async params => {
			const languageService = await getService(params.textDocument.uri);
			return nameCasing.detect(languageService.context, params.textDocument.uri);
		});

		connection.onRequest(GetConvertTagCasingEditsRequest.type, async params => {
			const languageService = await getService(params.textDocument.uri);
			return nameCasing.convert(languageService.context, languageService.findReferences, params.textDocument.uri, params.casing);
		});
	},
};
