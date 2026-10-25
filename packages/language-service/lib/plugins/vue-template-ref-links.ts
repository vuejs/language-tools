import type { LanguageServicePlugin } from '@volar/language-service';
import { forEachElementNode, getTemplateRef } from '@vue/language-core';
import { resolveEmbeddedCode } from '../utils';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-template-ref-links',
		capabilities: {
			documentLinkProvider: {},
		},
		create(context) {
			return {
				provideDocumentLinks(document) {
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'scriptsetup_raw') {
						return;
					}

					const { ir } = info.root;
					if (!ir.scriptSetup) {
						return;
					}

					const templateVirtualCode = info.script.generated.embeddedCodes.get('template');
					if (!templateVirtualCode) {
						return;
					}
					const templateDocumentUri = context.encodeEmbeddedDocumentUri(info.script.id, 'template');
					const templateDocument = context.documents.get(
						templateDocumentUri,
						templateVirtualCode.languageId,
						templateVirtualCode.snapshot,
					);

					const templateRefs = new Map<string, number[]>();
					if (ir.template?.ast) {
						for (const node of forEachElementNode(ir.template.ast)) {
							// ElementTypes.ELEMENT, ElementTypes.COMPONENT
							const ref = (node.tagType === 0 || node.tagType === 1) && getTemplateRef(node);
							if (ref) {
								let offsets = templateRefs.get(ref[0]);
								if (!offsets) {
									templateRefs.set(ref[0], offsets = []);
								}
								offsets.push(ref[1]);
							}
						}
					}
					const useTemplateRefs = info.root.scriptAnalysis.getScriptSetupRanges()?.useTemplateRef ?? [];

					return useTemplateRefs.flatMap(({ arg }) => {
						if (!arg) {
							return [];
						}
						const name = ir.scriptSetup!.content.slice(arg.start + 1, arg.end - 1);
						const range = {
							start: document.positionAt(arg.start + 1),
							end: document.positionAt(arg.end - 1),
						};

						return templateRefs.get(name)?.map(offset => {
							const start = templateDocument.positionAt(offset);
							const end = templateDocument.positionAt(offset + name.length);
							return {
								range,
								target: templateDocumentUri
									+ `#L${start.line + 1},${start.character + 1}-L${end.line + 1},${end.character + 1}`,
							};
						}) ?? [];
					});
				},
			};
		},
	};
}
