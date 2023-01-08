import type * as html from 'vscode-html-languageservice';
import { register as registerParsePugDocument } from './pugDocument';
import { register as registerCompletion } from './services/completion';
import { register as registerDocumentHighlight } from './services/documentHighlight';
import { register as registerDocumentLinks } from './services/documentLinks';
import { register as registerDocumentSymbols } from './services/documentSymbol';
import { register as registerHover } from './services/hover';
import { register as registerScanner } from './services/scanner';
import { register as registerSelectRanges } from './services/selectionRanges';
import { register as registerFoldingRanges } from './services/foldingRanges';
import { register as registerQuoteComplete } from './services/quoteComplete';

export { PugDocument } from './pugDocument';
export * from './baseParse';

export interface LanguageService extends ReturnType<typeof getLanguageService> { }

export function getLanguageService(htmlLs: html.LanguageService) {
	return {
		parsePugDocument: registerParsePugDocument(htmlLs),
		doComplete: registerCompletion(htmlLs),
		findDocumentHighlights: registerDocumentHighlight(htmlLs),
		findDocumentLinks: registerDocumentLinks(htmlLs),
		findDocumentSymbols: registerDocumentSymbols(htmlLs),
		doHover: registerHover(htmlLs),
		createScanner: registerScanner(htmlLs),
		getSelectionRanges: registerSelectRanges(htmlLs),
		doQuoteComplete: registerQuoteComplete(htmlLs),
		getFoldingRanges: registerFoldingRanges(),
	};
}
