import type { CodeSegment, IR, IRBlock } from '../types';

/**
 * Rebases the segments whose source is a block of the IR from block-relative offsets to file offsets, and drops
 * their source. Segments of any other source, like `'main'`, already map by file offsets and are kept as they are.
 */
export function resolveCodeOffsets<Data>(ir: IR, codes: readonly CodeSegment<Data>[]) {
	const blocks = new Map<string, IRBlock>();
	for (
		const block of [
			ir.template,
			ir.script,
			ir.scriptSetup,
			...ir.styles,
			...ir.customBlocks,
		]
	) {
		if (block) {
			blocks.set(block.name, block);
		}
	}
	return codes.map<CodeSegment<Data>>(segment => {
		if (typeof segment === 'string') {
			return segment;
		}
		const source = segment[1];
		if (source === undefined) {
			return segment;
		}
		const block = blocks.get(source);
		if (!block) {
			return segment;
		}
		return [
			segment[0],
			undefined,
			segment[2] + block.offset,
			segment[3],
		];
	});
}
