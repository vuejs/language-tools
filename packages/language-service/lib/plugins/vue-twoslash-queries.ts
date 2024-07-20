import type { LanguageServiceContext, LanguageServicePlugin, LanguageServicePluginInstance } from '@volar/language-service';
import * as vue from '@vue/language-core';
import type * as vscode from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';

const twoslashReg = /<!--\s*\^\?\s*-->/g;

export function create(
	getTsPluginClient?: (context: LanguageServiceContext) => typeof import('@vue/typescript-plugin/lib/client') | undefined
): LanguageServicePlugin {
	return {
		name: 'vue-twoslash-queries',
		capabilities: {
			inlayHintProvider: {},
		},
		create(context): LanguageServicePluginInstance {
			const tsPluginClient = getTsPluginClient?.(context);
			return {
				async provideInlayHints(document, range) {

					const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
					if (!(sourceScript?.generated?.root instanceof vue.VueVirtualCode) || virtualCode?.id !== 'template') {
						return;
					}

					const hoverOffsets: [vscode.Position, number][] = [];
					const inlayHints: vscode.InlayHint[] = [];

					for (const pointer of document.getText(range).matchAll(twoslashReg)) {
						const offset = pointer.index + pointer[0].indexOf('^?') + document.offsetAt(range.start);
						const position = document.positionAt(offset);
						hoverOffsets.push([position, document.offsetAt({
							line: position.line - 1,
							character: position.character,
						})]);
					}

					for (const [pointerPosition, hoverOffset] of hoverOffsets) {
						const map = context.language.maps.get(virtualCode, sourceScript);
						for (const [sourceOffset] of map.toSourceLocation(hoverOffset)) {
							const quickInfo = await tsPluginClient?.getQuickInfoAtPosition(sourceScript.generated.root.fileName, sourceOffset);
							if (quickInfo) {
								inlayHints.push({
									position: { line: pointerPosition.line, character: pointerPosition.character + 2 },
									label: quickInfo,
									paddingLeft: true,
									paddingRight: false,
								});
								break;
							}
						}
					}

					return inlayHints;
				},
			};
		},
	};
}
