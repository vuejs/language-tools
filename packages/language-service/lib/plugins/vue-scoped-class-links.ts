import type { LanguageServicePlugin } from '@volar/language-service';
import { tsCodegen } from '@vue/language-core';
import { getEmbeddedInfo } from '../utils';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-scoped-class-links',
		capabilities: {
			documentLinkProvider: {},
		},
		create(context) {
			return {
				provideDocumentLinks(document) {
					const info = getEmbeddedInfo(context, document, 'template');
					if (!info) {
						return;
					}
					const { sourceScript, root } = info;

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

						const styleDocumentUri = context.encodeEmbeddedDocumentUri(sourceScript.id, 'style_' + i);
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
