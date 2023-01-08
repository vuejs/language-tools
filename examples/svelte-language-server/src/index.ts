import { languageModule } from '@volar-examples/svelte-language-core';
import createTsPlugin from '@volar-plugins/typescript';
import { createConnection, startLanguageServer } from '@volar/language-server/node';

startLanguageServer(
	createConnection(),
	() => ({
		extraFileExtensions: [{ extension: 'svelte', isMixedContent: true, scriptKind: 7 }],
		getLanguageModules() {
			return [languageModule];
		},
		getLanguageServicePlugins() {
			return [createTsPlugin()];
		},
	}),
);
