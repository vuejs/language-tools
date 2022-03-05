import { definePlugin } from './definePlugin';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as pug from 'vscode-pug-languageservice';

export default definePlugin((host: {
    pugLs: pug.LanguageService,
    getHoverSettings(uri: string): Promise<html.HoverSettings | undefined>,
    documentContext: html.DocumentContext,
}) => {

    const pugDocuments = new WeakMap<TextDocument, [number, pug.PugDocument]>();

    return {
        async doHover(textDocument, position) {

            const pugDocument = getPugDocument(textDocument);

            if (!pugDocument)
                return;;

            const hoverSettings = await host.getHoverSettings(textDocument.uri);

            return host.pugLs.doHover(pugDocument, position, hoverSettings);
        },

        async doComplete(textDocument, position, context) {

            const pugDocument = getPugDocument(textDocument);

            if (!pugDocument)
                return;;

            return host.pugLs.doComplete(pugDocument, position, host.documentContext, /** TODO: CompletionConfiguration */);
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

        const doc = host.pugLs.parsePugDocument(document);
        pugDocuments.set(document, [document.version, doc]);

        return doc;
    }
});
