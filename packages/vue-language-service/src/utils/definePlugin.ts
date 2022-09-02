import { EmbeddedStructure } from '@volar/vue-language-core';
import { EmbeddedDocumentSourceMap, VueDocument } from '../vueDocuments';

export async function visitEmbedded(vueDocument: VueDocument, embeddeds: EmbeddedStructure[], cb: (sourceMap: EmbeddedDocumentSourceMap) => Promise<boolean>) {

	for (const embedded of embeddeds) {

		if (!await visitEmbedded(vueDocument, embedded.embeddeds, cb)) {
			return false;
		}

		if (embedded.self) {

			const sourceMap = vueDocument.sourceMapsMap.get(embedded.self);

			if (!await cb(sourceMap)) {
				return false;
			}
		}
	}

	return true;
}
