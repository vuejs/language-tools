import { rewritePieceText } from 'muggle-string';
import type { CodePiece, IR, IRBlock } from '../types';

/**
 * Rebases the pieces whose source is a block of `ir` to `ir`, at offsets of the file; a copy takes the text of the
 * block. The pieces of `ir` are kept as they are. A source that is neither `ir` nor one of its blocks throws.
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
		if (typeof piece === 'string' || piece.source === ir) {
			return piece;
		}
		const block = piece.source as IRBlock;
		if (!blocks.has(block)) {
			throw new Error(`A piece maps from the block '${block.name}', which is not a block of the IR.`);
		}
		return {
			source: ir,
			start: piece.start + block.offset,
			end: piece.end + block.offset,
			data: piece.data,
			text: rewritePieceText(piece),
		};
	});
}
