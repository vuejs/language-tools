import type * as ts from 'typescript';
export function getQuickInfoAtPosition(
	this: {
		languageService: ts.LanguageService;
	},
	fileName: string,
	position: number,
) {
	const { languageService } = this;
	return languageService.getQuickInfoAtPosition(fileName, position);
}
