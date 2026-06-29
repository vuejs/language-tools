import type { VueLanguagePlugin } from '../types';
import { allCodeFeatures } from './shared';

const plugin: VueLanguagePlugin = ({ vueCompilerOptions }) => {
	return {
		version: 2.2,

		getEmbeddedCodes(_fileName, ir) {
			if (vueCompilerOptions.environment !== 'languageservice') {
				return [];
			}
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
					allCodeFeatures,
				]);
			}
		},
	};
};

export default plugin;
