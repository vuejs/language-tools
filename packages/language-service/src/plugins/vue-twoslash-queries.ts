import { ServicePlugin, ServicePluginInstance, forEachEmbeddedFile } from '@volar/language-service';
import * as vue from '@vue/language-core';
import { Provide } from 'volar-service-typescript';
import type * as vscode from 'vscode-languageserver-protocol';

const twoslashReg = /<!--\s*\^\?\s*-->/g;

export function create(ts: typeof import('typescript/lib/tsserverlibrary')): ServicePlugin {
	return {
		name: 'vue-twoslash-queries',
		create(context): ServicePluginInstance {
			return {
				provideInlayHints(document, range) {
					return worker(document.uri, (vueFile) => {

						const hoverOffsets: [vscode.Position, number][] = [];
						const inlayHints: vscode.InlayHint[] = [];
						const languageService = context.inject<Provide, 'typescript/languageService'>('typescript/languageService');

						for (const pointer of document.getText(range).matchAll(twoslashReg)) {
							const offset = pointer.index! + pointer[0].indexOf('^?') + document.offsetAt(range.start);
							const position = document.positionAt(offset);
							hoverOffsets.push([position, document.offsetAt({
								line: position.line - 1,
								character: position.character,
							})]);
						}

						for (const virtualFile of forEachEmbeddedFile(vueFile)) {
							if (virtualFile.typescript) {
								for (const map of context.documents.getMaps(virtualFile)) {
									for (const [pointerPosition, hoverOffset] of hoverOffsets) {
										for (const [tsOffset, mapping] of map.map.getGeneratedOffsets(hoverOffset)) {
											if (vue.isHoverEnabled(mapping.data)) {
												const quickInfo = languageService.getQuickInfoAtPosition(virtualFile.fileName, tsOffset);
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
						}

						return inlayHints;
					});
				},
			};

			function worker<T>(uri: string, callback: (vueSourceFile: vue.VueFile) => T) {

				const [virtualFile] = context.language.files.getVirtualFile(context.env.uriToFileName(uri));
				if (!(virtualFile instanceof vue.VueFile))
					return;

				return callback(virtualFile);
			}
		},
	};
}
