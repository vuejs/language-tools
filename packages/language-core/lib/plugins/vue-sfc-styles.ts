import { enableAllFeatures } from '../generators/utils';
import type { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {

	return {

		version: 2,

		getEmbeddedFiles(_fileName, sfc) {
			return sfc.styles.map((style, i) => ({
				id: 'style_' + i,
				lang: style.lang,
			}));
		},

		resolveEmbeddedFile(_fileName, sfc, embeddedFile) {
			if (embeddedFile.id.startsWith('style_')) {
				const index = parseInt(embeddedFile.id.slice('style_'.length));
				const style = sfc.styles[index];

				embeddedFile.content.push([
					style.content,
					style.name,
					0,
					enableAllFeatures({}),
				]);
			}
		},
	};
};

export default plugin;
