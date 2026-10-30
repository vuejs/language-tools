import {
	type CodeSource,
	type IRScript,
	type IRScriptSetup,
	scriptFeatures,
	type VueCodeMarker,
} from '@vue/language-core';
import { createSourceRewrite, type RewriteSlice, type SourceRewrite } from 'muggle-string';
import { generatePiece, pieceSink, type TsCodeData, type TsPiece } from '../piece';
import type { ScriptEdit } from '../plugin';
import type { TsCode } from '../tsCode';
import { generateSfcBlockSection } from '../writers';

export interface BlockRewrite {
	rewrite: SourceRewrite<CodeSource, TsCodeData>;
	/** The code of `slice`. `terminate` adds the terminator of a truncated copy of the block (#3632). */
	render(slice: RewriteSlice<CodeSource, TsCodeData>, terminate?: boolean): TsCode[];
}

/**
 * An empty copy of the start of `block`, before its copies, so that an edit of the generated code there (e.g. an auto
 * import) maps back into the block even when it renders no source chars. TS 7.1 places an import at the top of the
 * file past this copy when a later verbatim segment exists, e.g. of the template, so that one misses an empty block;
 * see the expected failure in tests/lsp.spec.ts.
 */
export function generateBlockAnchor(block: IRScript | IRScriptSetup): Generator<TsCode> {
	return generatePiece({ source: block, start: 0, end: 0, data: { features: scriptFeatures } });
}

/** A rewrite of the content of `block`, with the script edits of the codegen plugins applied. */
export function createBlockRewrite(block: IRScript | IRScriptSetup, scriptEdits: readonly ScriptEdit[]): BlockRewrite {
	const rewrite = createSourceRewrite<CodeSource, TsCodeData>(block, block.content);
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
			const pieces: TsPiece[] = [];
			slice.render(pieceSink(pieces));
			const out: TsCode[] = [];
			for (const piece of pieces) {
				if (typeof piece === 'string' || piece.text === undefined && !terminate) {
					out.push(...generatePiece(piece));
				}
				else if (piece.text === undefined) {
					out.push(...generateSfcBlockSection(block, piece.start, piece.end, piece.data as VueCodeMarker));
				}
				else {
					// a segment of the code of an edit, which maps as it was given
					out.push([piece.text, piece.source, piece.start, piece.data]);
				}
			}
			return out;
		},
	};
}
