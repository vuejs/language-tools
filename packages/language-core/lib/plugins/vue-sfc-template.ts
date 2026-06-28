import type { VueLanguagePlugin } from '../types';
import { allCodeFeatures } from './shared';

const plugin: VueLanguagePlugin = ({ vueCompilerOptions }) => {
	return {
		version: 2.2,

		getEmbeddedCodes(_fileName, ir) {
			if (ir.template?.lang !== 'html' || vueCompilerOptions.environment !== 'languageservice') {
				return [];
			}
			return [{
				id: 'template',
				lang: ir.template.lang,
			}];
		},

		resolveEmbeddedCode(_fileName, ir, embeddedFile) {
			if (embeddedFile.id === 'template' && ir.template?.lang === 'html') {
				embeddedFile.content.push([
					ir.template.content,
					ir.template.name,
					0,
					allCodeFeatures,
				]);
			}
		},
	};
};

export default plugin;
