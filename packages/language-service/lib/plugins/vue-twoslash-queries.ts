import type { InlayHint, LanguageServicePlugin, Position } from '@volar/language-service';
import { resolveEmbeddedCode } from '../utils';

const twoslashTemplateReg = /<!--\s*\^\?\s*-->/g;
const twoslashScriptReg = /(?<=^|\n)\s*\/\/\s*\^\?/g;

export function create(
	{ getQuickInfoAtPosition }: import('@vue/typescript-plugin/lib/requests').Requests,
): LanguageServicePlugin {
	return {
		name: 'vue-twoslash-queries',
		capabilities: {
			inlayHintProvider: {},
		},
		create(context) {
			return {
				async provideInlayHints(document, range) {
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'template' && !info?.code.id.startsWith('script_')) {
						return;
					}

					const hoverOffsets: [Position, number][] = [];
					const inlayHints: InlayHint[] = [];
					const twoslashReg = info.code.id === 'template' ? twoslashTemplateReg : twoslashScriptReg;
					const sourceDocument = context.documents.get(info.script.id, info.script.languageId, info.script.snapshot);

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

					for (const [pointerPosition, hoverOffset] of hoverOffsets) {
						const map = context.language.maps.get(info.code, info.script);
						for (const [sourceOffset] of map.toSourceLocation(hoverOffset)) {
							const quickInfo = await getQuickInfoAtPosition(
								info.root.fileName,
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
