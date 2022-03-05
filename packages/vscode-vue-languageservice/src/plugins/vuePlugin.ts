import { definePlugin } from './definePlugin';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';

const vueTags: html.ITagData[] = [
    {
        name: 'template',
        attributes: [
            {
                name: 'lang',
                values: [
                    { name: 'html' },
                    { name: 'pug' },
                ],
            },
        ],
    },
    {
        name: 'script',
        attributes: [
            {
                name: 'lang',
                values: [
                    { name: 'js' },
                    { name: 'ts' },
                    { name: 'jsx' },
                    { name: 'tsx' },
                ],
            },
            { name: 'setup', valueSet: 'v' },
        ],
    },
    {
        name: 'style',
        attributes: [
            {
                name: 'lang',
                values: [
                    { name: 'css' },
                    { name: 'scss' },
                    { name: 'less' },
                ],
            },
            { name: 'scoped', valueSet: 'v' },
            { name: 'module', valueSet: 'v' },
        ],
    },
];

export default definePlugin((host: {
    documentContext: html.DocumentContext,
}) => {

    const htmlDocuments = new WeakMap<TextDocument, [number, html.HTMLDocument]>();
    const htmlLs = html.getLanguageService();
    const dataProvider = html.newHTMLDataProvider('vue', {
        version: 1.1,
        tags: vueTags,
    });
    htmlLs.setDataProviders(false, [dataProvider]);

    return {

        triggerCharacters: ['.', ':', '<', '"', '=', '/'], // https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/html-language-features/server/src/htmlServer.ts#L183

        async doComplete(textDocument, position) {

            const htmlDocument = getHtmlDocument(textDocument);

            if (!htmlDocument)
                return;;

            return htmlLs.doComplete2(textDocument, position, htmlDocument, host.documentContext);
        }
    };

    function getHtmlDocument(document: TextDocument) {

        if (document.languageId !== 'vue')
            return;

        const cache = htmlDocuments.get(document);
        if (cache) {
            const [cacheVersion, cacheDoc] = cache;
            if (cacheVersion === document.version) {
                return cacheDoc;
            }
        }

        const doc = htmlLs.parseHTMLDocument(document);
        htmlDocuments.set(document, [document.version, doc]);

        return doc;
    }
});
