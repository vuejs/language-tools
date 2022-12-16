import { EmbeddedFileKind, forEachEmbeddeds, LanguageServicePlugin, LanguageServicePluginContext, SourceFileDocument } from '@volar/language-service';
import * as vue from '@volar/vue-language-core';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';

export default function (options: {
	getVueDocument(document: TextDocument): SourceFileDocument | undefined,
}): LanguageServicePlugin {

	let context: LanguageServicePluginContext;

	return {

		setup(_context) {
			context = _context;
		},

		inlayHints: {

			on(document, range) {
				return worker(document, (vueDocument, vueFile) => {

					const ts = context.typescript.module;
					const hoverOffsets: [vscode.Position, number][] = [];
					const inlayHints: vscode.InlayHint[] = [];

					for (const pointer of document.getText(range).matchAll(/\^\?/g)) {
						const offset = pointer.index! + document.offsetAt(range.start);
						const position = document.positionAt(offset);
						hoverOffsets.push([position, document.offsetAt({
							line: position.line - 1,
							character: position.character,
						})]);
					}

					forEachEmbeddeds(vueFile, (embedded) => {
						if (embedded.kind === EmbeddedFileKind.TypeScriptHostFile) {
							const sourceMap = vueDocument.getSourceMap(embedded);
							for (const [pointerPosition, hoverOffset] of hoverOffsets) {
								for (const [tsOffset, mapping] of sourceMap.toGeneratedOffsets(hoverOffset)) {
									if (mapping.data.hover) {
										const quickInfo = context.typescript.languageService.getQuickInfoAtPosition(embedded.fileName, tsOffset);
										if (quickInfo) {
											inlayHints.push({
												position: { line: pointerPosition.line, character: pointerPosition.character + 2 },
												label: ts.displayPartsToString(quickInfo.displayParts),
												paddingLeft: true,
												paddingRight: false,
											});
										}
										break;
									}
								}
							}
						}
					});

					return inlayHints;
				});
			},
		},
	};

	function worker<T>(document: TextDocument, callback: (vueDocument: SourceFileDocument, vueSourceFile: vue.VueSourceFile) => T) {

		const vueDocument = options.getVueDocument(document);
		if (!vueDocument)
			return;

		if (!(vueDocument.file instanceof vue.VueSourceFile))
			return;

		return callback(vueDocument, vueDocument.file);
	}
}
