import type { CodeSegment, IR, IRBlock } from '../types';

/**
 * Rebases the segments whose source is a block of the IR from block-relative offsets to file offsets, and drops
 * their source. Segments without a source already map by file offsets and are kept as they are. A source that is
 * not a block of `ir` throws.
 */
export function resolveCodeOffsets<Data>(ir: IR, codes: readonly CodeSegment<Data>[]) {
	const blocks = new Set<IRBlock | undefined>([
		ir.template,
		ir.script,
		ir.scriptSetup,
		...ir.styles,
		...ir.customBlocks,
	]);
	return codes.map<CodeSegment<Data>>(segment => {
		if (typeof segment === 'string') {
			return segment;
		}
		const block = segment[1];
		if (block === undefined) {
			return segment;
		}
		if (!blocks.has(block)) {
			throw new Error(`A segment maps from the block '${block.name}', which is not a block of the IR.`);
		}
		return [
			segment[0],
			undefined,
			segment[2] + block.offset,
			segment[3],
		];
	});
}
