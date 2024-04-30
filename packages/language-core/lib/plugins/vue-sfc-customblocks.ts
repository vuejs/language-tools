import type { VueLanguagePlugin } from '../types';
import { allCodeFeatures } from './shared';

const plugin: VueLanguagePlugin = () => {

	return {

		version: 2,

		getEmbeddedCodes(_fileName, sfc) {
			return sfc.customBlocks.map((customBlock, i) => ({
				id: 'customBlock_' + i,
				lang: customBlock.lang,
			}));
		},

		resolveEmbeddedCode(_fileName, sfc, embeddedFile) {
			if (embeddedFile.id.startsWith('customBlock_')) {
				const index = parseInt(embeddedFile.id.slice('customBlock_'.length));
				const customBlock = sfc.customBlocks[index];

				embeddedFile.content.push([
					customBlock.content,
					customBlock.name,
					0,
					allCodeFeatures,
				]);
			}
		},
	};
};

export default plugin;
