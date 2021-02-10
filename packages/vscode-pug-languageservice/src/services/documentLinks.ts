import type { PugDocument } from '../pugDocument';
import type * as html from 'vscode-html-languageservice';
import { transformLocations } from '@volar/source-map';

export function register(htmlLanguageService: html.LanguageService) {
    return (pugDocument: PugDocument, documentContext: html.DocumentContext) => {

        const htmlResult = htmlLanguageService.findDocumentLinks(
            pugDocument.sourceMap.targetDocument,
            documentContext,
        );
        return transformLocations(htmlResult, pugDocument.sourceMap);
    }
}
