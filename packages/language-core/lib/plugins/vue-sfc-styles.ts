import { allFeatures } from '../features';
import type { Code, IR } from '../types';
import { embeddedCodeIds, type EmbeddedDocument } from '../virtualCode/embeddedDocument';

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
					[
						binding.text,
						style.name,
						binding.offset,
						{ features: allFeatures },
					],
					');\n',
				);
			}
			children.push({ id: id + embeddedCodeIds.styleInlineTsSuffix, lang: 'ts', content });
		}
		return {
			id,
			lang: style.lang,
			content: [[
				style.content,
				style.name,
				0,
				{ features: allFeatures },
			]],
			children,
		};
	});
}
