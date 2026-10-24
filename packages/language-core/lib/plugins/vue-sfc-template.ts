import { allFeatures } from '../codegen/features';
import type { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {
	return {
		version: 4,

		getEmbeddedCodes(_fileName, ir) {
			if (ir.template?.lang === 'html') {
				return [{
					id: 'template',
					lang: ir.template.lang,
				}];
			}
			return [];
		},

		resolveEmbeddedCode(_fileName, ir, embeddedFile) {
			if (embeddedFile.id === 'template' && ir.template?.lang === 'html') {
				embeddedFile.content.push([
					ir.template.content,
					ir.template.name,
					0,
					{ features: allFeatures },
				]);
			}
		},
	};
};

export default plugin;
