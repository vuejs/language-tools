import { type IRScript, type IRScriptSetup, scriptFeatures } from '@vue/language-core';
import { createSourceRewrite, type RewriteSlice, type RewriteWriter, type SourceRewrite } from 'muggle-string';
import type { ScriptEdit } from '../plugin';
import type { TsCode, TsCodeData } from '../tsCode';
import { generateTerminator } from '../writers';

export type ScriptBlock = IRScript | IRScriptSetup;

export type BlockWriter = RewriteWriter<ScriptBlock, TsCodeData>;

export type BlockSlice = RewriteSlice<ScriptBlock, TsCodeData>;

export interface BlockRewrite {
	rewrite: SourceRewrite<ScriptBlock, TsCodeData>;
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

/** A rewrite of the content of `block`, with the script edits of the codegen plugins applied. */
export function createBlockRewrite(block: ScriptBlock, scriptEdits: readonly ScriptEdit[]): BlockRewrite {
	const rewrite = createSourceRewrite<ScriptBlock, TsCodeData>(block, block.content);
	for (const edit of scriptEdits) {
		if (edit.block !== block) {
			continue;
		}
		const writer = rewrite.writer(edit.pluginIndex);
		switch (edit.kind) {
			case 'insertBefore':
			case 'insertAfter':
				writer[edit.kind](edit.offset, edit.code);
				break;
			case 'remove':
				writer.replace(edit.start, edit.end, '');
				break;
		}
	}
	return {
		rewrite,
		render(slice, terminate = true) {
			const pieces = slice.pieces([]);
			if (!terminate) {
				return pieces;
			}
			const out: TsCode[] = [];
			for (const piece of pieces) {
				out.push(piece);
				if (typeof piece !== 'string' && piece.source === block && piece.text === undefined) {
					out.push(...generateTerminator(block, piece.start, piece.end));
				}
			}
			return out;
		},
	};
}
