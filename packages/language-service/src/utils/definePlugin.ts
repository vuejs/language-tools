import { SourceFileDocuments, SourceMap } from '../documents';
import { PositionCapabilities, VirtualFile } from '@volar/language-core';

export async function visitEmbedded(
	documents: SourceFileDocuments,
	current: VirtualFile,
	cb: (file: VirtualFile, sourceMap: SourceMap<PositionCapabilities>) => Promise<boolean>,
	rootFile = current,
) {

	for (const embedded of current.embeddedFiles) {
		if (!await visitEmbedded(documents, embedded, cb, rootFile)) {
			return false;
		}
	}

	for (const [_, map] of documents.getMapsByVirtualFileName(current.fileName)) {
		if (documents.getRootFile(map.sourceDocument.uri) === rootFile) {
			if (!await cb(current, map)) {
				return false;
			}
		}
	}

	return true;
}
