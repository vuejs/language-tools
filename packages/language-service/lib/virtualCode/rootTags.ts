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
		// a block that is not written as an element (the template of a VitePress or petite-vue file) adds nothing
		if (block?.element) {
			blocks.push(block);
		}
	}
	blocks.sort((a, b) => a.offset - b.offset);
	const content: Code[] = [];
	let start = 0;
	for (const block of blocks) {
		const contentEnd = block.offset + block.content.length;
		if (start < block.offset) {
			content.push({ source: ir, start, end: block.offset, data: { features: allFeatures } });
		}
		// fix folding range end position failed to mapping
		const marker = block.offset
			+ block.content.lastIndexOf('\n', block.content.lastIndexOf('\n') - 1) + 1;
		if (block.offset < marker) {
			content.push(ir.content.slice(block.offset, marker));
		}
		content.push({ source: ir, start: marker, end: marker, data: { features: structureFeatures } });
		if (marker < contentEnd) {
			content.push(ir.content.slice(marker, contentEnd));
		}
		start = contentEnd;
	}
	if (start < ir.content.length || !blocks.length) {
		content.push({ source: ir, start, end: ir.content.length, data: { features: allFeatures } });
	}
	return { id: embeddedCodeIds.rootTags, lang: rootTagsLanguageId, content };
}
