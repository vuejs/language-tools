import { allFeatures, type Code, type IR, structureFeatures } from '@vue/language-core';
import { replaceSourceRange } from 'muggle-string';
import { embeddedCodeIds, type EmbeddedDocument, rootTagsLanguageId } from './embeddedDocument';

/** The whole file, for the SFC block features; it holds the documents of the blocks. */
export function getRootTagsDocument(ir: IR): EmbeddedDocument {
	const content: Code[] = [[ir.content, undefined, 0, { features: allFeatures }]];
	for (
		const block of [
			ir.template,
			ir.script,
			ir.scriptSetup,
			...ir.styles,
			...ir.customBlocks,
		]
	) {
		if (!block) {
			continue;
		}
		const offset = block.content.lastIndexOf('\n', block.content.lastIndexOf('\n') - 1) + 1;
		// fix folding range end position failed to mapping
		replaceSourceRange(
			content,
			undefined,
			block.startTagEnd,
			block.endTagStart,
			ir.content.slice(
				block.startTagEnd,
				block.startTagEnd + offset,
			),
			[
				'',
				undefined,
				block.startTagEnd + offset,
				{ features: structureFeatures },
			],
			ir.content.slice(
				block.startTagEnd + offset,
				block.endTagStart,
			),
		);
	}
	return { id: embeddedCodeIds.rootTags, lang: rootTagsLanguageId, content };
}
