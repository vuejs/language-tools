import { type IRBlock, type IRScript, type IRScriptSetup, scriptFeatures } from '@vue/language-core';
import { createSourceRewrite, type RewriteSlice, type RewriteWriter, type SourceRewrite } from 'muggle-string';
import type { TsCode, TsCodeData } from '../tsCode';
import { generateTerminator } from '../writers';

export type ScriptBlock = IRScript | IRScriptSetup;

export type BlockWriter = RewriteWriter<IRBlock, TsCodeData>;

export type BlockSlice = RewriteSlice<IRBlock, TsCodeData>;

export interface BlockRewrite {
	rewrite: SourceRewrite<IRBlock, TsCodeData>;
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
	const rewrite = createSourceRewrite<IRBlock, TsCodeData>(block, block.content);
	return {
		rewrite,
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
