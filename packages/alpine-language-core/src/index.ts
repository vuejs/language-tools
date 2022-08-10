import * as vue from '@volar/vue-language-core';
import useHtmlFilePlugin from './plugins/file-html';

export type LanguageServiceHost = vue.LanguageServiceHost;

export function createLanguageContext(host: vue.LanguageServiceHost): vue.LanguageContext {
	return vue.createLanguageContext(host, [useHtmlFilePlugin], ['.html']);
}
