import { type IRBlock, type IRScript, type IRScriptSetup, scriptFeatures } from '@vue/language-core';
import { getStartEnd } from '@vue/language-core/lib/typescript/nodes';
import {
	createSourceRewrite,
	type RewriteCode,
	type RewriteCutOptions,
	type RewriteSlice,
	type RewriteWriter,
	type SourceRewrite,
} from 'muggle-string';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { TsCode, TsCodeData } from '../tsCode';
import { generateTerminator } from '../writers';

export type ScriptBlock = IRScript | IRScriptSetup;

export type BlockSlice = RewriteSlice<IRBlock, TsCodeData>;

export type BlockCode = RewriteCode<IRBlock, TsCodeData>;

/** The writer of a script block: edits at offsets of its content, and cuts of nodes of its AST. */
export interface BlockWriter {
	insertBefore(offset: number, code: BlockCode): void;
	insertAfter(offset: number, code: BlockCode): void;
	replace(start: number, end: number, code: BlockCode): void;
	/**
	 * The text of `node`, a node inside the AST of the block, from its start without trivia to its end, with the edits
	 * of all writers in it; it renders where the slice is placed, and `placeholder` takes its place.
	 */
	cut(node: ts.Node, options: RewriteCutOptions<IRBlock, TsCodeData>): BlockSlice;
}

/** A rewrite of a script block, which is itself the writer of the outermost rank. */
export interface BlockRewrite extends BlockWriter {
	rewrite: SourceRewrite<IRBlock, TsCodeData>;
	/** The writer of `rank`, which sits inside the rewrite. */
	writer(rank: number): BlockWriter;
	/** The code of `slice`. `terminate` adds the terminator of a truncated copy of the block (#3632). */
	render(slice: BlockSlice, terminate?: boolean): TsCode[];
}

/**
 * An empty copy of the start of `block`, before its copies, so that an edit of the generated code there (e.g. an auto
 * import) maps back into the block even when it renders no source chars. TS 7.1 places an import at the top of the
 * file past this copy when a later verbatim piece exists, e.g. of the template, so that one misses an empty block;
 * see the expected failure in tests/lsp.spec.ts.
 */
export function generateBlockAnchor(block: ScriptBlock): TsCode {
	return { source: block, start: 0, end: 0, data: { features: scriptFeatures } };
}

/** A rewrite of the content of `block`. */
export function createBlockRewrite(block: ScriptBlock): BlockRewrite {
	const rewrite = createSourceRewrite<IRBlock, TsCodeData>(block);
	const createWriter = (writer: RewriteWriter<IRBlock, TsCodeData>): BlockWriter => ({
		insertBefore: (offset, code) => writer.insertBefore(offset, code),
		insertAfter: (offset, code) => writer.insertAfter(offset, code),
		replace: (start, end, code) => writer.replace(start, end, code),
		cut(node, options) {
			const { start, end } = getStartEnd(node, block.ast);
			return writer.cut(start, end, options);
		},
	});
	return {
		...createWriter(rewrite),
		rewrite,
		writer: rank => createWriter(rewrite.writer(rank)),
		render(slice, terminate = true) {
			const out: TsCode[] = [];
			slice.render(piece => {
				out.push(piece);
				if (terminate && typeof piece !== 'string' && piece.text === undefined && piece.source === block) {
					out.push(...generateTerminator(block, piece.start, piece.end));
				}
			});
			return out;
		},
	};
}
