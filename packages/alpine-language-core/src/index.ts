import * as vue from '@volar/vue-language-core';
import * as useHtmlFilePlugin from './plugins/file-html';

export type LanguageServiceHost = vue.LanguageServiceHost;

export function createLanguageContext(host: vue.LanguageServiceHost): vue.VueLanguageContext {
	return vue.createVueLanguageContext(host, [useHtmlFilePlugin], ['.html']);
}
