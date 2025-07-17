import type { InlayHint, LanguageServiceContext, LanguageServicePlugin, Position } from '@volar/language-service';
import { VueVirtualCode } from '@vue/language-core';
import { URI } from 'vscode-uri';

const twoslashTemplateReg = /<!--\s*\^\?\s*-->/g;
const twoslashScriptReg = /(?<=^|\n)\s*\/\/\s*\^\?/g;

export function create(
	getTsPluginClient?: (
		context: LanguageServiceContext,
	) => import('@vue/typescript-plugin/lib/requests').Requests | undefined,
): LanguageServicePlugin {
	return {
		name: 'vue-twoslash-queries',
		capabilities: {
			inlayHintProvider: {},
		},
		create(context) {
			const tsPluginClient = getTsPluginClient?.(context);
			return {
				async provideInlayHints(document, range) {
					const uri = URI.parse(document.uri);
					const decoded = context.decodeEmbeddedDocumentUri(uri);
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
					if (
						!sourceScript?.generated
						|| (virtualCode?.id !== 'template' && !virtualCode?.id.startsWith('script_'))
					) {
						return;
					}

					const root = sourceScript.generated.root;
					if (!(root instanceof VueVirtualCode)) {
						return;
					}

					const hoverOffsets: [Position, number][] = [];
					const inlayHints: InlayHint[] = [];

					const twoslashReg = virtualCode.id === 'template' ? twoslashTemplateReg : twoslashScriptReg;
					for (const pointer of document.getText(range).matchAll(twoslashReg)) {
						const offset = pointer.index + pointer[0].indexOf('^?') + document.offsetAt(range.start);
						const position = document.positionAt(offset);
						hoverOffsets.push([
							position,
							document.offsetAt({
								line: position.line - 1,
								character: position.character,
							}),
						]);
					}

					const sourceDocument = context.documents.get(decoded![0], sourceScript.languageId, sourceScript.snapshot);
					for (const [pointerPosition, hoverOffset] of hoverOffsets) {
						const map = context.language.maps.get(virtualCode, sourceScript);
						for (const [sourceOffset] of map.toSourceLocation(hoverOffset)) {
							const quickInfo = await tsPluginClient?.getQuickInfoAtPosition(
								root.fileName,
								sourceDocument.positionAt(sourceOffset),
							);
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
