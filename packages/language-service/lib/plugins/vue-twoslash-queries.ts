import type { InlayHint, LanguageServiceContext, LanguageServicePlugin, Position } from '@volar/language-service';
import { getEmbeddedInfo } from './utils';

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
					const info = getEmbeddedInfo(
						context,
						document,
						id => id === 'template' || id.startsWith('script_'),
					);
					if (!info) {
						return;
					}
					const { sourceScript, virtualCode, root } = info;

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

					const sourceDocument = context.documents.get(sourceScript.id, sourceScript.languageId, sourceScript.snapshot);
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
