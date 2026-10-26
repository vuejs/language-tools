import { allFeatures } from '../features';
import type { IR } from '../types';
import { embeddedCodeIds, type EmbeddedDocument } from '../virtualCode/embeddedDocument';

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
