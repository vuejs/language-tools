import * as json from 'vscode-json-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { EmbeddedLanguageServicePlugin } from '@volar/vue-language-service-types';
import * as vscode from 'vscode-languageserver-protocol';

export default function (options: {
	schema?: json.JSONSchema,
	schemaRequestService?: json.SchemaRequestService,
}): EmbeddedLanguageServicePlugin {

	const jsonDocuments = new WeakMap<TextDocument, [number, json.JSONDocument]>();
	const jsonLs = json.getLanguageService({ schemaRequestService: options.schemaRequestService });

	return {

		complete: {

			// https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/json-language-features/server/src/jsonServer.ts#L150
			triggerCharacters: ['"', ':'],

			on(document, position, context) {
				return worker(document, (jsonDocument) => {
					return jsonLs.doComplete(document, position, jsonDocument);
				});
			},

			resolve(item) {
				return jsonLs.doResolve(item);
			},
		},

		definition: {

			on(document, position) {
				return worker(document, (jsonDocument) => {
					return jsonLs.findDefinition(document, position, jsonDocument);
				});
			},
		},

		doValidation(document) {
			return worker(document, async (jsonDocument) => {

				const documentLanguageSettings = undefined; // await getSettings(); // TODO

				return jsonLs.doValidation(document, jsonDocument, documentLanguageSettings, options.schema) as Promise<vscode.Diagnostic[]>;
			});
		},

		doHover(document, position) {
			return worker(document, (jsonDocument) => {
				return jsonLs.doHover(document, position, jsonDocument);
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
				return jsonLs.format(document, range, options);
			});
		},
	};

	function worker<T>(document: TextDocument, callback: (jsonDocument: json.JSONDocument) => T) {

		const jsonDocument = getJsonDocument(document);
		if (!jsonDocument)
			return;

		return callback(jsonDocument);
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
