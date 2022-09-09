import * as vue from '@volar/vue-language-core';
import * as useHtmlFilePlugin from './plugins/file-html';

export type LanguageServiceHost = vue.VueLanguageServiceHost;

export function createLanguageContext(host: vue.VueLanguageServiceHost): vue.EmbeddedLanguageContext {
	return vue.createPresetLanguageContext(host, [useHtmlFilePlugin], ['.html']).languageContext;
}
