import { definePlugin } from './definePlugin';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as pug from 'vscode-pug-languageservice';

export default definePlugin((host, { htmlLs }: { htmlLs: html.LanguageService }) => {

    const pugLs = pug.getLanguageService(htmlLs);
    const pugDocuments = new WeakMap<TextDocument, [number, pug.PugDocument]>();

    return {
        async onHover(textDocument, position) {

            const pugDocument = getPugDocument(textDocument);

            if (!pugDocument)
                return;;

            const hoverSettings = await host.getSettings<html.HoverSettings>('html.hover', textDocument.uri);

            return pugLs.doHover(pugDocument, position, hoverSettings);
        },
    };

    function getPugDocument(document: TextDocument) {

        if (document.languageId !== 'jade')
            return;

        const cache = pugDocuments.get(document);
        if (cache) {
            const [cacheVersion, cacheDoc] = cache;
            if (cacheVersion === document.version) {
                return cacheDoc;
            }
        }

        const doc = pugLs.parsePugDocument(document);
        pugDocuments.set(document, [document.version, doc]);

        return doc;
    }
});
