import { EmbeddedFileKind, forEachEmbeddeds, LanguageServicePlugin, LanguageServicePluginContext, SourceFileDocuments } from '@volar/language-service';
import * as vue from '@volar/vue-language-core';
import * as vscode from 'vscode-languageserver-protocol';

export default function (options: {
	documents: SourceFileDocuments,
}): LanguageServicePlugin {

	let context: LanguageServicePluginContext;

	return {

		setup(_context) {
			context = _context;
		},

		inlayHints: {

			on(document, range) {
				return worker(document.uri, (vueFile) => {

					const ts = context.typescript.module;
					const hoverOffsets: [vscode.Position, number][] = [];
					const inlayHints: vscode.InlayHint[] = [];

					for (const pointer of document.getText(range).matchAll(/<!--\s*\^\?\s*-->/g)) {
						const offset = pointer.index! + pointer[0].indexOf('^?') + document.offsetAt(range.start);
						const position = document.positionAt(offset);
						hoverOffsets.push([position, document.offsetAt({
							line: position.line - 1,
							character: position.character,
						})]);
					}

					forEachEmbeddeds(vueFile, (embedded) => {
						if (embedded.kind === EmbeddedFileKind.TypeScriptHostFile) {
							for (const [_, map] of options.documents.getMapsByVirtualFileUri(document.uri)) {
								for (const [pointerPosition, hoverOffset] of hoverOffsets) {
									for (const [tsOffset, mapping] of map.map.toGeneratedOffsets(hoverOffset)) {
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
						}
					});

					return inlayHints;
				});
			},
		},
	};

	function worker<T>(uri: string, callback: (vueSourceFile: vue.VueFile) => T) {

		const virtualFile = options.documents.getVirtualFile(uri);
		if (!(virtualFile instanceof vue.VueFile))
			return;

		return callback(virtualFile);
	}
}
