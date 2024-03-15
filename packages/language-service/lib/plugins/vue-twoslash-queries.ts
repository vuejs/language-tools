import type { ServicePlugin, ServicePluginInstance } from '@volar/language-service';
import * as vue from '@vue/language-core';
import type * as vscode from 'vscode-languageserver-protocol';

const twoslashReg = /<!--\s*\^\?\s*-->/g;

export function create(
	ts: typeof import('typescript'),
	tsPluginClient?: typeof import('@vue/typescript-plugin/lib/client'),
): ServicePlugin {
	return {
		name: 'vue-twoslash-queries',
		create(context): ServicePluginInstance {
			return {
				async provideInlayHints(document, range) {

					const [virtualCode, sourceFile] = context.documents.getVirtualCodeByUri(document.uri);
					if (!(sourceFile?.generated?.code instanceof vue.VueGeneratedCode) || virtualCode?.id !== 'template') {
						return;
					}

					const hoverOffsets: [vscode.Position, number][] = [];
					const inlayHints: vscode.InlayHint[] = [];

					for (const pointer of document.getText(range).matchAll(twoslashReg)) {
						const offset = pointer.index! + pointer[0].indexOf('^?') + document.offsetAt(range.start);
						const position = document.positionAt(offset);
						hoverOffsets.push([position, document.offsetAt({
							line: position.line - 1,
							character: position.character,
						})]);
					}

					for (const [pointerPosition, hoverOffset] of hoverOffsets) {
						for (const [_1, [_2, map]] of context.language.files.getMaps(virtualCode)) {
							for (const [sourceOffset] of map.getSourceOffsets(hoverOffset)) {
								const quickInfo = await tsPluginClient?.getQuickInfoAtPosition(sourceFile.generated.code.fileName, sourceOffset);
								if (quickInfo) {
									inlayHints.push({
										position: { line: pointerPosition.line, character: pointerPosition.character + 2 },
										label: ts.displayPartsToString(quickInfo.displayParts),
										paddingLeft: true,
										paddingRight: false,
									});
									break;
								}
							}
							break;
						}
					}

					return inlayHints;
				},
			};
		},
	};
}
