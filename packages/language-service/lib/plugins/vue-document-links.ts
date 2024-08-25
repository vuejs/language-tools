import type { LanguageServicePlugin, LanguageServicePluginInstance } from '@volar/language-service';
import { Sfc, VueVirtualCode, tsCodegen } from '@vue/language-core';
import type * as vscode from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-document-links',
		capabilities: {
			documentLinkProvider: {},
		},
		create(context): LanguageServicePluginInstance {
			return {
				provideDocumentLinks(document) {

					const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);

					if (sourceScript?.generated?.root instanceof VueVirtualCode && virtualCode?.id === 'template') {

						const result: vscode.DocumentLink[] = [];
						const codegen = tsCodegen.get(sourceScript.generated.root.sfc);
						const scopedClasses = codegen?.generatedTemplate()?.scopedClasses ?? [];
						const styleClasses = new Map<string, {
							index: number;
							style: Sfc['styles'][number];
							classOffset: number;
						}[]>();
						const option = sourceScript.generated.root.vueCompilerOptions.experimentalResolveStyleCssClasses;

						for (let i = 0; i < sourceScript.generated.root.sfc.styles.length; i++) {
							const style = sourceScript.generated.root.sfc.styles[i];
							if (option === 'always' || (option === 'scoped' && style.scoped)) {
								for (const className of style.classNames) {
									if (!styleClasses.has(className.text.substring(1))) {
										styleClasses.set(className.text.substring(1), []);
									}
									styleClasses.get(className.text.substring(1))!.push({
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
									const styleDocument = context.documents.get(styleDocumentUri, styleVirtualCode.languageId, styleVirtualCode.snapshot);
									const start = styleDocument.positionAt(style.classOffset);
									const end = styleDocument.positionAt(style.classOffset + className.length + 1);
									result.push({
										range: {
											start: document.positionAt(offset),
											end: document.positionAt(offset + className.length),
										},
										target: context.encodeEmbeddedDocumentUri(decoded![0], 'style_' + style.index) + `#L${start.line + 1},${start.character + 1}-L${end.line + 1},${end.character + 1}`,
									});
								}
							}
						}

						return result;
					}
				},
			};
		},
	};
}
