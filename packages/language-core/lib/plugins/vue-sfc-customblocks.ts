import { allFeatures } from '../features';
import type { EmbeddedCodePlugin } from '../virtualCode/embeddedCodes';

const plugin: EmbeddedCodePlugin = () => {
	return {
		version: 4,

		getEmbeddedCodes(_fileName, ir) {
			return ir.customBlocks.map((customBlock, i) => ({
				id: 'custom_block_' + i,
				lang: customBlock.lang,
			}));
		},

		resolveEmbeddedCode(_fileName, ir, embeddedFile) {
			if (embeddedFile.id.startsWith('custom_block_')) {
				const index = parseInt(embeddedFile.id.slice('custom_block_'.length));
				const customBlock = ir.customBlocks[index]!;

				embeddedFile.content.push([
					customBlock.content,
					customBlock.name,
					0,
					{ features: allFeatures },
				]);
			}
		},
	};
};

export default plugin;
