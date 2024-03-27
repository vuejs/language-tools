import { generate as generateInlineCss } from '../generators/inlineCss';
import type { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {

	return {

		version: 2,

		getEmbeddedCodes(_fileName, sfc) {
			if (!sfc.template?.ast) {
				return [];
			}
			return [{ id: 'template_inline_css', lang: 'css' }];
		},

		resolveEmbeddedCode(_fileName, sfc, embeddedFile) {
			if (embeddedFile.id !== 'template_inline_css' || !sfc.template?.ast) {
				return;
			}
			embeddedFile.parentCodeId = 'template';
			embeddedFile.content.push(...generateInlineCss(sfc.template.ast));
		},
	};
};

export default plugin;
