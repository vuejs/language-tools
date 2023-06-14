import { FileKind, forEachEmbeddedFile, Service, ServiceContext } from '@volar/language-service';
import * as vue from '@vue/language-core';
import type * as vscode from 'vscode-languageserver-protocol';

const plugin: Service = (context: ServiceContext<import('volar-service-typescript').Provide> | undefined, modules) => {

	if (!context || !modules?.typescript)
		return {};

	const ts = modules.typescript;

	return {

		provideInlayHints(document, range) {
			return worker(document.uri, (vueFile) => {

				const hoverOffsets: [vscode.Position, number][] = [];
				const inlayHints: vscode.InlayHint[] = [];
				const languageService = context.inject('typescript/languageService');

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
										const quickInfo = languageService.getQuickInfoAtPosition(embedded.fileName, tsOffset);
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
	};

	function worker<T>(uri: string, callback: (vueSourceFile: vue.VueFile) => T) {

		const [virtualFile] = context!.documents.getVirtualFileByUri(uri);
		if (!(virtualFile instanceof vue.VueFile))
			return;

		return callback(virtualFile);
	}
};

export default () => plugin;
