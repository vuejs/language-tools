import type { DocumentLink, LanguageServicePlugin } from '@volar/language-service';
import { type Sfc, tsCodegen, VueVirtualCode } from '@vue/language-core';
import { URI } from 'vscode-uri';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-document-links',
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
					if (!sourceScript?.generated || (virtualCode?.id !== 'template' && virtualCode?.id !== 'scriptsetup_raw')) {
						return;
					}

					const root = sourceScript.generated.root;
					if (!(root instanceof VueVirtualCode)) {
						return;
					}

					const { sfc } = root;
					const codegen = tsCodegen.get(sfc);
					const result: DocumentLink[] = [];

					if (virtualCode.id === 'template') {
						const scopedClasses = codegen?.getGeneratedTemplate()?.scopedClasses ?? [];
						const styleClasses = new Map<string, {
							index: number;
							style: Sfc['styles'][number];
							classOffset: number;
						}[]>();
						const option = root.vueCompilerOptions.resolveStyleClassNames;

						for (let i = 0; i < sfc.styles.length; i++) {
							const style = sfc.styles[i];
							if (option === true || (option === 'scoped' && style.scoped)) {
								for (const className of style.classNames) {
									if (!styleClasses.has(className.text.slice(1))) {
										styleClasses.set(className.text.slice(1), []);
									}
									styleClasses.get(className.text.slice(1))!.push({
										index: i,
										style,
										classOffset: className.offset,
									});
								}
							}
						}

						for (const { className, offset } of scopedClasses) {
							const styles = styleClasses.get(className);
							if (styles) {
								for (const style of styles) {
									const styleDocumentUri = context.encodeEmbeddedDocumentUri(decoded![0], 'style_' + style.index);
									const styleVirtualCode = sourceScript.generated.embeddedCodes.get('style_' + style.index);
									if (!styleVirtualCode) {
										continue;
									}
									const styleDocument = context.documents.get(
										styleDocumentUri,
										styleVirtualCode.languageId,
										styleVirtualCode.snapshot,
									);
									const start = styleDocument.positionAt(style.classOffset);
									const end = styleDocument.positionAt(style.classOffset + className.length + 1);
									result.push({
										range: {
											start: document.positionAt(offset),
											end: document.positionAt(offset + className.length),
										},
										target: context.encodeEmbeddedDocumentUri(decoded![0], 'style_' + style.index)
											+ `#L${start.line + 1},${start.character + 1}-L${end.line + 1},${end.character + 1}`,
									});
								}
							}
						}
					} else if (virtualCode.id === 'scriptsetup_raw') {
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

						for (const { arg } of useTemplateRefs) {
							if (!arg) {
								continue;
							}

							const name = sfc.scriptSetup.content.slice(arg.start + 1, arg.end - 1);

							for (const { offset } of templateRefs?.get(name) ?? []) {
								const start = templateDocument.positionAt(offset);
								const end = templateDocument.positionAt(offset + name.length);

								result.push({
									range: {
										start: document.positionAt(arg.start + 1),
										end: document.positionAt(arg.end - 1),
									},
									target: templateDocumentUri
										+ `#L${start.line + 1},${start.character + 1}-L${end.line + 1},${end.character + 1}`,
								});
							}
						}
					}

					return result;
				},
			};
		},
	};
}
