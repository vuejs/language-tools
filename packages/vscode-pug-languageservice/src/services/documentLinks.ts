import { transformLocations } from '@volar/source-map';
import type * as html from 'vscode-html-languageservice';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
    return (pugDoc: PugDocument, docContext: html.DocumentContext) => {

        const htmlResult = htmlLs.findDocumentLinks(
            pugDoc.sourceMap.mappedDocument,
            docContext,
        );

        return transformLocations(htmlResult, pugDoc.sourceMap);
    }
}
