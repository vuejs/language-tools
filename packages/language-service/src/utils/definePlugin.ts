import { EmbeddedDocumentSourceMap, SourceFileDocument } from '../documents';

export async function visitEmbedded(
	vueDocument: SourceFileDocument,
	cb: (sourceMap: EmbeddedDocumentSourceMap) => Promise<boolean>,
	embeddeds = vueDocument.file.embeddeds,
) {

	for (const embedded of embeddeds) {

		if (!await visitEmbedded(vueDocument, cb, embedded.embeddeds)) {
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
