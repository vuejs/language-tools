import * as alpine from '@volar/alpine-language-service';
import { createNodeServer } from '@volar/embedded-language-server/out/nodeServer';

createNodeServer({
	definitelyExts: ['.html'],
	indeterminateExts: [],
	semanticTokenLegend: alpine.getSemanticTokenLegend(),
	getDocumentService: alpine.getDocumentService,
	createLanguageService: (ts, sys, tsConfig, host, env, customPlugins) => {
		return alpine.createLanguageService(
			{
				...host,
				getVueCompilationSettings: () => ({}),
			},
			env,
			customPlugins ?? [],
		);
	},
});
