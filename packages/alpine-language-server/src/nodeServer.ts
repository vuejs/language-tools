import * as alpine from '@volar/alpine-language-service';
import { createNodeServer } from '@volar/embedded-language-server/out/nodeServer';

createNodeServer({
	definitelyExts: ['.html'],
	indeterminateExts: [],
	getDocumentService: alpine.getDocumentService,
	createLanguageService: (ts, parsedCommandLine, host, env, customPlugins) => {
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
