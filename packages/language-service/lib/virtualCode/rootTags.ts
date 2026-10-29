import { allFeatures, type Code, type IR, type IRBlock, structureFeatures } from '@vue/language-core';
import { embeddedCodeIds, type EmbeddedDocument, rootTagsLanguageId } from './embeddedDocument';

/** The whole file, for the SFC block features; it holds the documents of the blocks. */
export function getRootTagsDocument(ir: IR): EmbeddedDocument {
	const blocks: IRBlock[] = [];
	for (
		const block of [
			ir.template,
			ir.script,
			ir.scriptSetup,
			...ir.styles,
			...ir.customBlocks,
		]
	) {
		// a block without tags (the template of a VitePress or petite-vue file) adds nothing
		if (block && block.start < block.startTagEnd) {
			blocks.push(block);
		}
	}
	blocks.sort((a, b) => a.startTagEnd - b.startTagEnd);
	const content: Code[] = [];
	let start = 0;
	for (const block of blocks) {
		if (start < block.startTagEnd) {
			content.push([ir.content.slice(start, block.startTagEnd), undefined, start, { features: allFeatures }]);
		}
		// fix folding range end position failed to mapping
		const marker = block.startTagEnd
			+ block.content.lastIndexOf('\n', block.content.lastIndexOf('\n') - 1) + 1;
		if (block.startTagEnd < marker) {
			content.push(ir.content.slice(block.startTagEnd, marker));
		}
		content.push(['', undefined, marker, { features: structureFeatures }]);
		if (marker < block.endTagStart) {
			content.push(ir.content.slice(marker, block.endTagStart));
		}
		start = block.endTagStart;
	}
	if (start < ir.content.length || !blocks.length) {
		content.push([ir.content.slice(start), undefined, start, { features: allFeatures }]);
	}
	return { id: embeddedCodeIds.rootTags, lang: rootTagsLanguageId, content };
}
