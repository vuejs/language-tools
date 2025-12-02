import type { LanguageServicePlugin } from '@volar/language-service';
import { references } from '@vue/language-core/lib/codegen/template/styleScopedClasses';
import { resolveEmbeddedCode } from '../utils';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-scoped-class-links',
		capabilities: {
			documentLinkProvider: {},
		},
		create(context) {
			return {
				provideDocumentLinks(document) {
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'template') {
						return;
					}
					const { sfc } = info.root;
					if (!sfc.template) {
						return;
					}
					const { resolveStyleClassNames } = info.root.vueCompilerOptions;
					if (!resolveStyleClassNames) {
						return;
					}
					const scopedClasses = references.get(sfc.template)?.[1] ?? [];
					const styleClasses = new Map<string, string[]>();

					for (const style of sfc.styles) {
						if (!(resolveStyleClassNames === true || style.scoped)) {
							continue;
						}

						const styleDocumentUri = context.encodeEmbeddedDocumentUri(info.script.id, style.name);
						const styleVirtualCode = info.script.generated.embeddedCodes.get(style.name);
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

					return scopedClasses.flatMap(([className, offset]) => {
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
