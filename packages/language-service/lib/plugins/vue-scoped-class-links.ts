import type { LanguageServicePlugin } from '@volar/language-service';
import { tsCodegen, VueVirtualCode } from '@vue/language-core';
import { URI } from 'vscode-uri';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-scoped-class-links',
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
					if (!sourceScript?.generated || virtualCode?.id !== 'template') {
						return;
					}

					const root = sourceScript.generated.root;
					if (!(root instanceof VueVirtualCode)) {
						return;
					}

					const { sfc } = root;
					const codegen = tsCodegen.get(sfc);

					const option = root.vueCompilerOptions.resolveStyleClassNames;
					const scopedClasses = codegen?.getGeneratedTemplate()?.scopedClasses ?? [];
					const styleClasses = new Map<string, string[]>();

					for (let i = 0; i < sfc.styles.length; i++) {
						const style = sfc.styles[i];
						if (option !== true && !(option === 'scoped' && style.scoped)) {
							continue;
						}

						const styleDocumentUri = context.encodeEmbeddedDocumentUri(decoded![0], 'style_' + i);
						const styleVirtualCode = sourceScript.generated.embeddedCodes.get('style_' + i);
						if (!styleVirtualCode) {
							continue;
						}
						const styleDocument = context.documents.get(
							styleDocumentUri,
							styleVirtualCode.languageId,
							styleVirtualCode.snapshot,
						);

						for (const { text, offset } of style.classNames) {
							const start = styleDocument.positionAt(offset);
							const end = styleDocument.positionAt(offset + text.length);
							const target = styleDocumentUri
								+ `#L${start.line + 1},${start.character + 1}-L${end.line + 1},${end.character + 1}`;
							if (!styleClasses.has(text)) {
								styleClasses.set(text, []);
							}
							styleClasses.get(text)!.push(target);
						}
					}

					return scopedClasses.flatMap(({ className, offset }) => {
						const range = {
							start: document.positionAt(offset),
							end: document.positionAt(offset + className.length),
						};
						return styleClasses.get('.' + className)?.map(target => ({
							range,
							target,
						})) ?? [];
					});
				},
			};
		},
	};
}
