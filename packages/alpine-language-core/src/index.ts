import * as vue from '@volar/vue-language-core';
import * as useHtmlFilePlugin from './plugins/file-html';

export * from '@volar/vue-language-core';

export function createEmbeddedLanguageModule(host: vue.LanguageServiceHost) {
	return vue.createEmbeddedLanguageModule(host, [useHtmlFilePlugin], ['.html']);
}
