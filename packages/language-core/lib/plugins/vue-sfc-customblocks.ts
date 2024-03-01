import { enableAllFeatures } from '../generators/utils';
import type { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {

	return {

		version: 2,

		getEmbeddedFiles(_fileName, sfc) {
			return sfc.customBlocks.map((customBlock, i) => ({
				id: 'customBlock_' + i,
				lang: customBlock.lang,
			}));
		},

		resolveEmbeddedFile(_fileName, sfc, embeddedFile) {
			if (embeddedFile.id.startsWith('customBlock_')) {
				const index = parseInt(embeddedFile.id.slice('customBlock_'.length));
				const customBlock = sfc.customBlocks[index];

				embeddedFile.content.push([
					customBlock.content,
					customBlock.name,
					0,
					enableAllFeatures({}),
				]);
			}
		},
	};
};

export default plugin;
