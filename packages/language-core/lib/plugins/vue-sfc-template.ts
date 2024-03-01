import { enableAllFeatures } from '../generators/utils';
import type { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {

	return {

		version: 2,

		getEmbeddedFiles(_fileName, sfc) {
			if (sfc.template) {
				return [{
					id: 'template',
					lang: sfc.template.lang,
				}];
			}
			return [];
		},

		resolveEmbeddedFile(_fileName, sfc, embeddedFile) {
			if (embeddedFile.id === 'template' && sfc.template) {
				embeddedFile.content.push([
					sfc.template.content,
					sfc.template.name,
					0,
					enableAllFeatures({}),
				]);
			}
		},
	};
};

export default plugin;
