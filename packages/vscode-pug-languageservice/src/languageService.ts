import type * as html from 'vscode-html-languageservice';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { parsePugDocument } from './pugDocument';
import { register as registerComplete } from './services/complete';
import { register as registerDocumentLinks } from './services/documentLinks';
import { register as registerHighlights } from './services/highlights';
import { register as registerHover } from './services/hover';
import { register as registerScanner } from './services/scanner';
import { register as registerSelectRanges } from './services/selectRanges';

export type LanguageService = ReturnType<typeof getLanguageService>;

export function getLanguageService(htmlLanguageService: html.LanguageService) {
    return {
        htmlLanguageService,
        parsePugDocument: (document: TextDocument) => parsePugDocument(document, htmlLanguageService),
        doComplete: registerComplete(htmlLanguageService),
        findDocumentLinks: registerDocumentLinks(htmlLanguageService),
        findDocumentHighlights: registerHighlights(htmlLanguageService),
        doHover: registerHover(htmlLanguageService),
        createScanner: registerScanner(htmlLanguageService),
        getSelectionRanges: registerSelectRanges(htmlLanguageService),
    };
}
