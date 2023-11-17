import { FileKind, forEachEmbeddedFile, Service, ServiceContext } from '@volar/language-service';
import * as vue from '@vue/language-core';
import type * as vscode from 'vscode-languageserver-protocol';

const twoslashReg = /<!--\s*\^\?\s*-->/g;

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

				for (const pointer of document.getText(range).matchAll(twoslashReg)) {
					const offset = pointer.index! + pointer[0].indexOf('^?') + document.offsetAt(range.start);
					const position = document.positionAt(offset);
					hoverOffsets.push([position, document.offsetAt({
						line: position.line - 1,
						character: position.character,
					})]);
				}

				forEachEmbeddedFile(vueFile, (virtualFile) => {
					if (virtualFile.kind === FileKind.TypeScriptHostFile) {
						for (const map of context.documents.getMapsByVirtualFile(virtualFile)) {
							for (const [pointerPosition, hoverOffset] of hoverOffsets) {
								for (const [tsOffset, mapping] of map.map.toGeneratedOffsets(hoverOffset)) {
									if (mapping.data.hover) {
										const quickInfo = languageService.getQuickInfoAtPosition(context.env.uriToFileName(virtualFile.id), tsOffset);
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

		const [virtualFile] = context!.project.fileProvider.getVirtualFile(uri);
		if (!(virtualFile instanceof vue.VueFile))
			return;

		return callback(virtualFile);
	}
};

export const create = () => plugin;
