import type { RequestContext } from './types';

export function getQuickInfoAtPosition(
	this: RequestContext,
	fileName: string,
	position: number,
) {
	const { languageService } = this;
	return languageService.getQuickInfoAtPosition(fileName, position);
}
