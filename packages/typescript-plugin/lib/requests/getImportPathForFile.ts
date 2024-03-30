import type * as ts from 'typescript';

export function getImportPathForFile(
	this: {
		typescript: typeof import('typescript');
		languageService: ts.LanguageService;
	},
	fileName: string,
	importFileName: string,
) {
	const { typescript: ts, languageService } = this;
	// TODO
	return importFileName.replace('./', '@/');
}
