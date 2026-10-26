import { allFeatures, type IR } from '@vue/language-core';
import { embeddedCodeIds, type EmbeddedDocument } from './embeddedDocument';

/** Each custom block, in its own `lang`. */
export function getCustomBlockDocuments(ir: IR): EmbeddedDocument[] {
	return ir.customBlocks.map((customBlock, i) => ({
		id: embeddedCodeIds.customBlockPrefix + i,
		lang: customBlock.lang,
		content: [[
			customBlock.content,
			customBlock.name,
			0,
			{ features: allFeatures },
		]],
	}));
}
