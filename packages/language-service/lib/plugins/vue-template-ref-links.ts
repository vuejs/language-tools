import type { LanguageServicePlugin } from '@volar/language-service';
import { tsCodegen, VueVirtualCode } from '@vue/language-core';
import { URI } from 'vscode-uri';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-template-ref-links',
		capabilities: {
			documentLinkProvider: {},
		},
		create(context) {
			return {
				provideDocumentLinks(document) {
					const uri = URI.parse(document.uri);
					const decoded = context.decodeEmbeddedDocumentUri(uri);
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
					if (!sourceScript?.generated || virtualCode?.id !== 'scriptsetup_raw') {
						return;
					}

					const root = sourceScript.generated.root;
					if (!(root instanceof VueVirtualCode)) {
						return;
					}

					const { sfc } = root;
					const codegen = tsCodegen.get(sfc);

					if (!sfc.scriptSetup) {
						return;
					}

					const templateVirtualCode = sourceScript.generated.embeddedCodes.get('template');
					if (!templateVirtualCode) {
						return;
					}
					const templateDocumentUri = context.encodeEmbeddedDocumentUri(decoded![0], 'template');
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
