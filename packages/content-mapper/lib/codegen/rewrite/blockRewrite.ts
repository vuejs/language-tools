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
	/**
	 * If the block renders no source chars (it is empty, or plugins removed all of it), one empty copy of it, so that
	 * an edit of the generated code there (e.g. an auto import) maps back into the block. TS 7.1 places an import at
	 * the top of the file past this copy when a later verbatim segment exists, e.g. of the template, so that one misses
	 * the block; see the expected failure in tests/lsp.spec.ts.
	 */
	generateEmptyCopy(): Generator<TsCode>;
}

/** A rewrite of the content of `block`, with the script edits of the codegen plugins applied. */
export function createBlockRewrite(block: IRScript | IRScriptSetup, scriptEdits: readonly ScriptEdit[]): BlockRewrite {
	const rewrite = createSourceRewrite<CodeSource, TsCodeData>(block, block.content);
	const removals: [number, number][] = [];
	for (const edit of scriptEdits) {
		if (edit.block !== block) {
			continue;
		}
		const writer = rewrite.writer(edit.pluginIndex);
		const code = () => edit.code;
		if (edit.kind === 'replace') {
			writer.replace(edit.start, edit.end, code);
			removals.push([edit.start, edit.end]);
		}
		else {
			writer[edit.kind](edit.offset, code);
		}
	}
	return {
		rewrite,
		render(slice, terminate = true) {
			const pieces: TsPiece[] = [];
			slice.render(pieceSink(pieces));
			const out: TsCode[] = [];
			for (const piece of pieces) {
				if (terminate && typeof piece === 'object' && piece.text === undefined) {
					out.push(...generateSfcBlockSection(block, piece.start, piece.end, piece.data as VueCodeMarker));
				}
				else {
					out.push(...generatePiece(piece));
				}
			}
			return out;
		},
		*generateEmptyCopy() {
			if (!rendersSource(block.content.length, removals)) {
				yield ['', block, 0, { features: scriptFeatures }];
			}
		},
	};
}

function rendersSource(length: number, removals: [number, number][]) {
	let kept = 0;
	for (const [start, end] of removals.sort((a, b) => a[0] - b[0])) {
		if (start > kept) {
			return true;
		}
		kept = Math.max(kept, end);
	}
	return kept < length;
}
