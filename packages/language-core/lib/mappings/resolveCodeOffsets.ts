import { type CodePiece, type IR, type IRBlock, pieceText } from '../types';

/**
 * Rebases the pieces whose source is a block of the IR from block-relative offsets to file offsets, and drops their
 * source; a copy takes the text of the block. Pieces without a source already map by file offsets and are kept as they
 * are. A source that is not a block of `ir` throws.
 */
export function resolveCodeOffsets<Data>(ir: IR, codes: readonly CodePiece<Data>[]) {
	const blocks = new Set<IRBlock | undefined>([
		ir.template,
		ir.script,
		ir.scriptSetup,
		...ir.styles,
		...ir.customBlocks,
	]);
	return codes.map<CodePiece<Data>>(piece => {
		if (typeof piece === 'string' || piece.source === undefined) {
			return piece;
		}
		const block = piece.source;
		if (!blocks.has(block)) {
			throw new Error(`A piece maps from the block '${block.name}', which is not a block of the IR.`);
		}
		return {
			source: undefined,
			start: piece.start + block.offset,
			end: piece.end + block.offset,
			data: piece.data,
			text: pieceText(piece),
		};
	});
}
