import type { RequestContext } from './types';

export function getQuickInfoAtPosition(
	this: RequestContext,
	fileName: string,
	position: number
) {
	const { typescript: ts, languageService } = this;
	return ts.displayPartsToString(languageService.getQuickInfoAtPosition(fileName, position)?.displayParts ?? []);
}
