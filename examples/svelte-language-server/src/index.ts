import { languageModule } from '@volar-examples/svelte-language-core';
import useTsPlugin from '@volar-plugins/typescript';
import { createLanguageServer, LanguageServerPlugin } from '@volar/language-server/node';

const plugin: LanguageServerPlugin = () => ({
	extraFileExtensions: [{ extension: 'svelte', isMixedContent: true, scriptKind: 7 }],
	semanticService: {
		getLanguageModules() {
			return [languageModule];
		},
		getServicePlugins() {
			return [
				useTsPlugin(),
			];
		},
	},
	syntacticService: {
		getLanguageModules() {
			return [languageModule];
		},
		getServicePlugins() {
			return [
				useTsPlugin(),
			];
		}
	},
});

createLanguageServer([plugin]);
