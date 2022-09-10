// import * as alpine from '@volar/alpine-language-service';
// import { createNodeServer } from '@volar/language-server/out/nodeServer';

// createNodeServer({
// 	definitelyExts: ['.html'],
// 	indeterminateExts: [],
// 	semanticTokenLegend: alpine.getSemanticTokenLegend(),
// 	languageService: {
// 		getLanguageModules(host) {
// 			return [alpine.createEmbeddedLanguageModule(
// 				host.getTypeScriptModule(),
// 				host.getCurrentDirectory(),
// 				host.getCompilationSettings(),
// 				{},
// 			)];
// 		},
// 	},
// 	getDocumentService: alpine.getDocumentService,
// });
