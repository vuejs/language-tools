import { type IRScript, type IRScriptSetup, scriptFeatures, type VueCodeMarker } from '@vue/language-core';
import type { ScriptEdit } from '../plugin';
import type { TsCode } from '../tsCode';
import { generateSfcBlockSection } from '../utils';
import { createSourceRewrite, type RewriteSink, type RewriteSlice, type SourceRewrite } from '.';

/** The data of a segment of generated TypeScript code. */
export type TsCodeData = Exclude<TsCode, string>[3];

/**
 * The sink that appends to `out` the code of a slice of a rewrite of `block`, whose cuts have the marker of their
 * copy of the user's code as data. `terminate` adds the terminator of a truncated copy (#3632).
 */
export function tsCodeSink(
	block: IRScript | IRScriptSetup,
	out: TsCode[],
	terminate = true,
): RewriteSink<TsCodeData> {
	return {
		text: text => out.push(text),
		source: (_, start, end, marker) => {
			if (terminate) {
				out.push(...generateSfcBlockSection(block, start, end, marker as VueCodeMarker));
			}
			else {
				out.push([block.content.slice(start, end), block.name, start, marker]);
			}
		},
		segment: segment => out.push(segment),
	};
}

export interface BlockRewrite {
	rewrite: SourceRewrite<TsCodeData>;
	/** The code of `slice`. */
	render(slice: RewriteSlice<TsCodeData>, terminate?: boolean): TsCode[];
	/**
	 * If the block renders no source chars (it is empty, or plugins removed all of it), one empty copy of it, so that
	 * an edit of the generated code there (e.g. an auto import) maps back into the block.
	 */
	generateEmptyCopy(): Generator<TsCode>;
}

/** A rewrite of the content of `block`, with the script edits of the codegen plugins applied. */
export function createBlockRewrite(block: IRScript | IRScriptSetup, scriptEdits: readonly ScriptEdit[]): BlockRewrite {
	const rewrite = createSourceRewrite<TsCodeData>(block.name, block.content);
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
		render(slice, terminate) {
			const out: TsCode[] = [];
			slice.render(tsCodeSink(block, out, terminate));
			return out;
		},
		*generateEmptyCopy() {
			if (!rendersSource(block.content.length, removals)) {
				yield ['', block.name, 0, { features: scriptFeatures }];
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
