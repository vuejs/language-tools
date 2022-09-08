import { EmbeddedStructure } from '@volar/embedded-language-core';
import { EmbeddedDocumentSourceMap, SourceFileDocument } from '../vueDocuments';

export async function visitEmbedded(vueDocument: SourceFileDocument, embeddeds: EmbeddedStructure[], cb: (sourceMap: EmbeddedDocumentSourceMap) => Promise<boolean>) {

	for (const embedded of embeddeds) {

		if (!await visitEmbedded(vueDocument, embedded.embeddeds, cb)) {
			return false;
		}

		if (embedded.self) {

			const sourceMap = vueDocument.getSourceMap(embedded.self);

			if (!await cb(sourceMap)) {
				return false;
			}
		}
	}

	return true;
}
