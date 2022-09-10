import { LanguageConfigs } from '@volar/embedded-language-server';
import * as vue from '@volar/vue-language-service';
import { DetectTagCasingRequest, GetConvertTagCasingEditsRequest } from './requests';
import * as nameCasing from '@volar/vue-language-service/out/ideFeatures/nameCasing';

export const languageConfigs: LanguageConfigs<vue.ParsedCommandLine, vue.LanguageService> = {
	definitelyExts: ['.vue'],
	indeterminateExts: ['.md', '.html'],
	semanticTokenLegend: vue.getSemanticTokenLegend(),
	getDocumentService: vue.getDocumentService,
	createLanguageService: (ts, sys, tsConfig, host, env, customPlugins) => {
		let vueOptions: vue.VueCompilerOptions = {};
		if (typeof tsConfig === 'string') {
			vueOptions = vue.createParsedCommandLine(ts, sys, tsConfig).vueOptions;
		}
		return vue.createLanguageService(
			{
				...host,
				getVueCompilationSettings: () => vueOptions,
			},
			env,
			customPlugins,
		);
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
