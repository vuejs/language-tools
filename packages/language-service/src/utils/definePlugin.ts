import { EmbeddedDocumentSourceMap, SourceFileDocument } from '../documents';

export async function visitEmbedded(
	vueDocument: SourceFileDocument,
	cb: (sourceMap: EmbeddedDocumentSourceMap) => Promise<boolean>,
	current = vueDocument.file,
) {

	for (const embedded of current.embeddeds) {

		if (!await visitEmbedded(vueDocument, cb, embedded)) {
			return false;
		}
	}

	const sourceMap = vueDocument.maps.get(current);

	if (sourceMap && !await cb(sourceMap)) {
		return false;
	}

	return true;
}
