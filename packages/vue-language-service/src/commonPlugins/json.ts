import * as json from 'vscode-json-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { EmbeddedLanguageServicePlugin } from '@volar/vue-language-service-types';
import * as vscode from 'vscode-languageserver-protocol';

export default function (host: {
    schema?: json.JSONSchema,
    schemaRequestService?: json.SchemaRequestService,
}): EmbeddedLanguageServicePlugin {

    const jsonDocuments = new WeakMap<TextDocument, [number, json.JSONDocument]>();
    const jsonLs = json.getLanguageService({ schemaRequestService: host.schemaRequestService });

    return {

        doValidation(document) {
            return worker(document, async (jsonDocument) => {

                const documentLanguageSettings = undefined; // await getSettings(); // TODO

                return jsonLs.doValidation(document, jsonDocument, documentLanguageSettings, host.schema) as Promise<vscode.Diagnostic[]>;
            });
        },

        doComplete(document, position, context) {
            return worker(document, (jsonDocument) => {
                return jsonLs.doComplete(document, position, jsonDocument);
            });
        },

        doCompleteResolve(item) {
            return jsonLs.doResolve(item);
        },

        doHover(document, position) {
            return worker(document, (jsonDocument) => {
                return jsonLs.doHover(document, position, jsonDocument);
            });
        },

        findDefinition(document, position) {
            return worker(document, (jsonDocument) => {
                return jsonLs.findDefinition(document, position, jsonDocument);
            });
        },

        findDocumentLinks(document) {
            return worker(document, (jsonDocument) => {
                return jsonLs.findLinks(document, jsonDocument);
            });
        },

        findDocumentSymbols(document) {
            return worker(document, (jsonDocument) => {
                return jsonLs.findDocumentSymbols(document, jsonDocument);
            });
        },

        findDocumentColors(document) {
            return worker(document, (jsonDocument) => {
                return jsonLs.findDocumentColors(document, jsonDocument);
            });
        },

        getColorPresentations(document, color, range) {
            return worker(document, (jsonDocument) => {
                return jsonLs.getColorPresentations(document, jsonDocument, color, range);
            });
        },

        getFoldingRanges(document) {
            return worker(document, (jsonDocument) => {
                return jsonLs.getFoldingRanges(document);
            });
        },

        getSelectionRanges(document, positions) {
            return worker(document, (jsonDocument) => {
                return jsonLs.getSelectionRanges(document, positions, jsonDocument);
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

                return jsonLs.format(document, range, options);
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

        const doc = jsonLs.parseJSONDocument(textDocument);
        jsonDocuments.set(textDocument, [textDocument.version, doc]);

        return doc;
    }
}
