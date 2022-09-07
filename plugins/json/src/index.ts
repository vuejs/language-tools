import { EmbeddedLanguageServicePlugin, useConfigurationHost, useSchemaRequestService } from '@volar/common-language-service';
import * as json from 'vscode-json-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';

export default function (): EmbeddedLanguageServicePlugin {

	const schemaRequestService = useSchemaRequestService();

	const jsonDocuments = new WeakMap<TextDocument, [number, json.JSONDocument]>();
	const jsonLs = json.getLanguageService({ schemaRequestService });

	return {

		complete: {

			// https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/json-language-features/server/src/jsonServer.ts#L150
			triggerCharacters: ['"', ':'],

			on(document, position, context) {
				return worker(document, async (jsonDocument) => {
					return await jsonLs.doComplete(document, position, jsonDocument);
				});
			},

			async resolve(item) {
				return await jsonLs.doResolve(item);
			},
		},

		definition: {

			on(document, position) {
				return worker(document, async (jsonDocument) => {
					return await jsonLs.findDefinition(document, position, jsonDocument);
				});
			},
		},

		doValidation(document) {
			return worker(document, async (jsonDocument) => {

				const documentLanguageSettings = undefined; // await getSettings(); // TODO

				return await jsonLs.doValidation(
					document,
					jsonDocument,
					documentLanguageSettings,
					undefined, // TODO
				) as vscode.Diagnostic[];
			});
		},

		doHover(document, position) {
			return worker(document, async (jsonDocument) => {
				return await jsonLs.doHover(document, position, jsonDocument);
			});
		},

		findDocumentLinks(document) {
			return worker(document, async (jsonDocument) => {
				return await jsonLs.findLinks(document, jsonDocument);
			});
		},

		findDocumentSymbols(document) {
			return worker(document, async (jsonDocument) => {
				return await jsonLs.findDocumentSymbols(document, jsonDocument);
			});
		},

		findDocumentColors(document) {
			return worker(document, async (jsonDocument) => {
				return await jsonLs.findDocumentColors(document, jsonDocument);
			});
		},

		getColorPresentations(document, color, range) {
			return worker(document, async (jsonDocument) => {
				return await jsonLs.getColorPresentations(document, jsonDocument, color, range);
			});
		},

		getFoldingRanges(document) {
			return worker(document, async (jsonDocument) => {
				return await jsonLs.getFoldingRanges(document);
			});
		},

		getSelectionRanges(document, positions) {
			return worker(document, async (jsonDocument) => {
				return await jsonLs.getSelectionRanges(document, positions, jsonDocument);
			});
		},

		format(document, range, options) {
			return worker(document, async (jsonDocument) => {

				const options_2 = await useConfigurationHost()?.getConfiguration<json.FormattingOptions & { enable: boolean; }>('json.format', document.uri);

				if (options_2?.enable === false) {
					return;
				}

				const edits = jsonLs.format(document, range, {
					...options_2,
					...options,
					insertFinalNewline: true,
				});

				if (!edits.length) {
					return edits;
				}

				const newText = TextDocument.applyEdits(document, edits);

				return [{
					newText: '\n' + newText.trim() + '\n',
					range: {
						start: document.positionAt(0),
						end: document.positionAt(document.getText().length),
					},
				}];
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
