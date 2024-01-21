import { ServicePlugin, ServicePluginInstance } from '@volar/language-service';
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
					return worker(document.uri, (vueFile, { generated }) => {

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

						if (generated) {
							const script = generated.languagePlugin.typescript?.getScript(vueFile);
							if (script) {
								for (const map of context.documents.getMaps(script.code)) {
									for (const [pointerPosition, hoverOffset] of hoverOffsets) {
										for (const [tsOffset, mapping] of map.map.getGeneratedOffsets(hoverOffset)) {
											if (vue.isHoverEnabled(mapping.data)) {
												const fileName = context.env.typescript.uriToFileName(vueFile.id);
												const quickInfo = languageService.getQuickInfoAtPosition(fileName, tsOffset);
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

			function worker<T>(uri: string, callback: (vueSourceFile: vue.VueGeneratedCode, sourceFile: vue.SourceFile) => T) {

				const [virtualCode, sourceFile] = context.documents.getVirtualCodeByUri(uri);
				if (!(virtualCode instanceof vue.VueGeneratedCode))
					return;

				return callback(virtualCode, sourceFile!);
			}
		},
	};
}
