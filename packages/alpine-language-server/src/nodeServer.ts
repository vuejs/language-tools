import * as vue from '@volar/vue-language-service';
import * as vuePlugin from '@volar/vue-language-server/out/plugin';
import { createNodeServer } from '@volar/language-server/out/nodeServer';
import * as alpineHtmlPlugin from './vueLanguagePlugins/file-html';

createNodeServer([{
	...vuePlugin,
	exts: ['.html'],
	languageService: {
		...vuePlugin.languageService,
		getLanguageModules(host) {
			return [vue.createEmbeddedLanguageModule(
				host.getTypeScriptModule(),
				host.getCurrentDirectory(),
				host.getCompilationSettings(),
				{},
				[alpineHtmlPlugin],
			)];
		},
	},
}]);
