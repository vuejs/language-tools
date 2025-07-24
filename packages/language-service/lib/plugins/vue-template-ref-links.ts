import type { LanguageServicePlugin } from '@volar/language-service';
import { tsCodegen } from '@vue/language-core';
import { getEmbeddedInfo } from './utils';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-template-ref-links',
		capabilities: {
			documentLinkProvider: {},
		},
		create(context) {
			return {
				provideDocumentLinks(document) {
					const info = getEmbeddedInfo(context, document, 'scriptsetup_raw');
					if (!info) {
						return;
					}
					const { sourceScript, root } = info;

					const { sfc } = root;
					const codegen = tsCodegen.get(sfc);

					if (!sfc.scriptSetup) {
						return;
					}

					const templateVirtualCode = sourceScript.generated.embeddedCodes.get('template');
					if (!templateVirtualCode) {
						return;
					}
					const templateDocumentUri = context.encodeEmbeddedDocumentUri(sourceScript.id, 'template');
					const templateDocument = context.documents.get(
						templateDocumentUri,
						templateVirtualCode.languageId,
						templateVirtualCode.snapshot,
					);

					const templateRefs = codegen?.getGeneratedTemplate()?.templateRefs;
					const useTemplateRefs = codegen?.getScriptSetupRanges()?.useTemplateRef ?? [];

					return useTemplateRefs.flatMap(({ arg }) => {
						if (!arg) {
							return [];
						}
						const name = sfc.scriptSetup!.content.slice(arg.start + 1, arg.end - 1);
						const range = {
							start: document.positionAt(arg.start + 1),
							end: document.positionAt(arg.end - 1),
						};

						return templateRefs?.get(name)?.map(({ offset }) => {
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
