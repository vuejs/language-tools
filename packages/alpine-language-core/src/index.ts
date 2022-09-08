import * as vue from '@volar/vue-language-core';
import * as useHtmlFilePlugin from './plugins/file-html';

export type LanguageServiceHost = vue.VueLanguageServiceHost;

export function createLanguageContext(host: vue.VueLanguageServiceHost): vue.VueLanguageContext {
	return vue.createVueLanguageContext(host, [useHtmlFilePlugin], ['.html']);
}
