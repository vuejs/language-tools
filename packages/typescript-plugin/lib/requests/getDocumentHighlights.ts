import type { RequestContext } from './types';

export function getDocumentHighlights(
	this: RequestContext,
	fileName: string,
	position: number
) {
	const { languageService } = this;
	return languageService.getDocumentHighlights(fileName, position, [fileName]);
}
