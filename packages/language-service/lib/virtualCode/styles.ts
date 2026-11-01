import { allFeatures, type Code, type IR } from '@vue/language-core';
import { embeddedCodeIds, type EmbeddedDocument } from './embeddedDocument';

/** Each style block, holding the TypeScript of its `v-bind()` bindings if it has any. */
export function getStyleDocuments(ir: IR): EmbeddedDocument[] {
	return ir.styles.map((style, i) => {
		const id = embeddedCodeIds.stylePrefix + i;
		const children: EmbeddedDocument[] = [];
		if (style.bindings.length) {
			const content: Code[] = [];
			for (const binding of style.bindings) {
				content.push(
					'(',
					{
						source: style,
						start: binding.offset,
						end: binding.offset + binding.text.length,
						data: { features: allFeatures },
						text: binding.text,
					},
					');\n',
				);
			}
			children.push({ id: id + embeddedCodeIds.styleInlineTsSuffix, lang: 'ts', content });
		}
		return {
			id,
			lang: style.lang,
			content: [{ source: style, start: 0, end: style.content.length, data: { features: allFeatures } }],
			children,
		};
	});
}
