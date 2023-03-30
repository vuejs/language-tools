import { FileKind, forEachEmbeddedFile, LanguageServicePlugin } from '@volar/language-service';
import * as vue from '@volar/vue-language-core';
import * as vscode from 'vscode-languageserver-protocol';

const plugin: LanguageServicePlugin = (context) => {

	if (!context?.typescript)
		return {};

	const _ts = context.typescript;

	return {

		provideInlayHints(document, range) {
			return worker(document.uri, (vueFile) => {

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

				forEachEmbeddedFile(vueFile, (embedded) => {
					if (embedded.kind === FileKind.TypeScriptHostFile) {
						for (const [_, map] of context.documents.getMapsByVirtualFileName(embedded.fileName)) {
							for (const [pointerPosition, hoverOffset] of hoverOffsets) {
								for (const [tsOffset, mapping] of map.map.toGeneratedOffsets(hoverOffset)) {
									if (mapping.data.hover) {
										const quickInfo = _ts.languageService.getQuickInfoAtPosition(embedded.fileName, tsOffset);
										if (quickInfo) {
											inlayHints.push({
												position: { line: pointerPosition.line, character: pointerPosition.character + 2 },
												label: _ts.module.displayPartsToString(quickInfo.displayParts),
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
	};

	function worker<T>(uri: string, callback: (vueSourceFile: vue.VueFile) => T) {

		const [virtualFile] = context!.documents.getVirtualFileByUri(uri);
		if (!(virtualFile instanceof vue.VueFile))
			return;

		return callback(virtualFile);
	}
};

export default () => plugin;
