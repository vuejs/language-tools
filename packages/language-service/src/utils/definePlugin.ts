import { SourceFileDocuments, SourceMap } from '../documents';
import { PositionCapabilities, VirtualFile } from '@volar/language-core';

export async function visitEmbedded(
	documents: SourceFileDocuments,
	current: VirtualFile,
	cb: (file: VirtualFile, sourceMap: SourceMap<PositionCapabilities>) => Promise<boolean>,
) {

	for (const embedded of current.embeddeds) {
		if (!await visitEmbedded(documents, embedded, cb)) {
			return false;
		}
	}

	for (const [_, map] of documents.getMapsByVirtualFileName(current.fileName)) {
		if (!await cb(current, map)) {
			return false;
		}
	}

	return true;
}
