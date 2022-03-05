import * as json from 'vscode-json-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { definePlugin } from './definePlugin';
import * as vscode from 'vscode-languageserver-protocol';

// https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/json-language-features/server/src/jsonServer.ts#L150
export const triggerCharacters = ['"', ':'];

export default definePlugin((host: {
    getJsonLs: () => json.LanguageService,
    getDocumentLanguageSettings?(): Promise<json.DocumentLanguageSettings | undefined>,
    schema?: json.JSONSchema,
}) => {

    const jsonDocuments = new WeakMap<TextDocument, [number, json.JSONDocument]>();

    return {

        doValidation(document) {
            return worker(document, async (jsonDocument) => {

                const documentLanguageSettings = await host.getDocumentLanguageSettings?.();

                return host.getJsonLs().doValidation(document, jsonDocument, documentLanguageSettings, host.schema) as Promise<vscode.Diagnostic[]>;
            });
        },

        doComplete(document, position, context) {
            return worker(document, (jsonDocument) => {
                return host.getJsonLs().doComplete(document, position, jsonDocument);
            });
        },

        doCompleteResolve(item) {
            return host.getJsonLs().doResolve(item);
        },

        doHover(document, position) {
            return worker(document, (jsonDocument) => {
                return host.getJsonLs().doHover(document, position, jsonDocument);
            });
        },

        findDefinition(document, position) {
            return worker(document, (jsonDocument) => {
                return host.getJsonLs().findDefinition(document, position, jsonDocument);
            });
        },

        findDocumentLinks(document) {
            return worker(document, (jsonDocument) => {
                return host.getJsonLs().findLinks(document, jsonDocument);
            });
        },

        findDocumentSymbols(document) {
            return worker(document, (jsonDocument) => {
                return host.getJsonLs().findDocumentSymbols(document, jsonDocument);
            });
        },

        findDocumentColors(document) {
            return worker(document, (jsonDocument) => {
                return host.getJsonLs().findDocumentColors(document, jsonDocument);
            });
        },

        getColorPresentations(document, color, range) {
            return worker(document, (jsonDocument) => {
                return host.getJsonLs().getColorPresentations(document, jsonDocument, color, range);
            });
        },

        getFoldingRanges(document) {
            return worker(document, (jsonDocument) => {
                return host.getJsonLs().getFoldingRanges(document);
            });
        },

        getSelectionRanges(document, positions) {
            return worker(document, (jsonDocument) => {
                return host.getJsonLs().getSelectionRanges(document, positions, jsonDocument);
            });
        },

        format(document, range, options) {
            return worker(document, (jsonDocument) => {

                if (!range) {
                    range = vscode.Range.create(
                        vscode.Position.create(0, 0),
                        document.positionAt(document.getText().length),
                    );
                }

                return host.getJsonLs().format(document, range, options);
            });
        },
    };

    function worker<T>(document: TextDocument, callback: (jsonDocument: json.JSONDocument) => T) {

        const htmlDocument = getJsonDocument(document);
        if (!htmlDocument)
            return;

        return callback(htmlDocument);
    }

    function getJsonDocument(textDocument: TextDocument) {

        if (textDocument.languageId !== 'json' && textDocument.languageId !== 'jsonc')
            return;

        const cache = jsonDocuments.get(textDocument);
        if (cache) {
            const [cacheVersion, cacheDoc] = cache;
            if (cacheVersion === textDocument.version) {
                return cacheDoc;
            }
        }

        const doc = host.getJsonLs().parseJSONDocument(textDocument);
        jsonDocuments.set(textDocument, [textDocument.version, doc]);

        return doc;
    }
});
