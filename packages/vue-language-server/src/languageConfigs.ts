import { LanguageConfigs } from '@volar/embedded-language-server';
import * as shared from '@volar/shared';
import * as vue from '@volar/vue-language-service';
import { DetectTagCasingRequest, GetConvertTagCasingEditsRequest } from './requests';

export const languageConfigs: LanguageConfigs<vue.ParsedCommandLine, vue.LanguageService> = {
	definitelyExts: ['.vue'],
	indeterminateExts: ['.md', '.html'],
	semanticTokenLegend: vue.getSemanticTokenLegend(),
	getDocumentService: vue.getDocumentService,
	createParsedCommandLine: (ts, sys, rootPath, tsConfig) => {
		try {
			const parseConfigHost: ts.ParseConfigHost = {
				useCaseSensitiveFileNames: sys.useCaseSensitiveFileNames,
				readDirectory: (path, extensions, exclude, include, depth) => {
					const exts = [...extensions, '.vue'];
					for (const passiveExt of ['.md', '.html']) {
						if (include.some(i => i.endsWith(passiveExt))) {
							exts.push(passiveExt);
						}
					}
					return sys.readDirectory(path, exts, exclude, include, depth);
				},
				fileExists: sys.fileExists,
				readFile: sys.readFile,
			};
			if (typeof tsConfig === 'string') {
				return vue.createParsedCommandLine(ts, parseConfigHost, tsConfig);
			}
			else {
				const content = ts.parseJsonConfigFileContent({}, parseConfigHost, rootPath, tsConfig, 'jsconfig.json');
				content.options.outDir = undefined; // TODO: patching ts server broke with outDir + rootDir + composite/incremental
				content.fileNames = content.fileNames.map(shared.normalizeFileName);
				return { ...content, vueOptions: {} };
			}
		}
		catch {
			return {
				errors: [],
				fileNames: [],
				options: {},
				vueOptions: {},
			};
		}
	},
	createLanguageService: (parsedCommandLine, host, env, customPlugins) => {
		return vue.createLanguageService(
			{
				...host,
				getVueCompilationSettings: () => parsedCommandLine.vueOptions,
			},
			env,
			customPlugins,
		);
	},
	handleLanguageFeature: (connection, getService) => {

		connection.onRequest(DetectTagCasingRequest.type, async params => {
			const languageService = await getService(params.textDocument.uri);
			return languageService?.__internal__.detectTagNameCasing(params.textDocument.uri);
		});

		connection.onRequest(GetConvertTagCasingEditsRequest.type, async params => {
			const languageService = await getService(params.textDocument.uri);
			return languageService?.__internal__.getConvertTagCasingEdits(params.textDocument.uri, params.casing);
		});
	},
};
