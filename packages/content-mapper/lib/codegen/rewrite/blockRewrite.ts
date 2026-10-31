import { type IRBlock, type IRScript, type IRScriptSetup, scriptFeatures } from '@vue/language-core';
import { getStartEnd } from '@vue/language-core/lib/typescript/nodes';
import {
	createSourceRewrite,
	type Piece,
	type RewriteCode,
	type RewriteCutOptions,
	type RewritePart,
	type RewriteSlice,
	type RewriteWriter,
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
	 * of all writers in it; it renders where the slice is placed, exactly once, and `placeholder` takes its place.
	 */
	cut(node: ts.Node, options: RewriteCutOptions<IRBlock, TsCodeData>): BlockSlice;
}

/** A rewrite of a script block, which is itself the writer of the outermost rank. */
export interface BlockRewrite extends BlockWriter {
	/** The writer of `rank`, which sits inside the rewrite. */
	writer(rank: number): BlockWriter;
	/**
	 * The code of the text at `start`..`end`, with the edits in it, but for the text of the slices cut from it. `terminate`
	 * adds the terminator of a truncated copy of the block (#3632).
	 */
	render(start: number, end: number, terminate?: boolean): TsCode[];
	/** The code of `slice`, which the rewrite cut, placed in the generated code by itself. */
	renderSlice(slice: BlockSlice, terminate?: boolean): TsCode[];
	/** The slices that the writers cut and that have not rendered, which is an error once the code is generated. */
	unrendered(): BlockSlice[];
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

/** A cut that a writer asked for, which the first render makes, when all writers have cut. */
class CutRequest implements BlockSlice {
	slice: RewriteSlice<IRBlock, TsCodeData> | undefined;

	constructor(
		readonly flush: () => void,
		readonly start: number,
		readonly end: number,
		readonly options: RewriteCutOptions<IRBlock, TsCodeData>,
	) {}

	render(sink: (piece: Piece<{ source: IRBlock; data: TsCodeData }>) => void) {
		this.flush();
		this.slice!.render(sink);
	}
}

/**
 * A rewrite of the content of `block`. The writers cut nodes in any order, and a later cut may hold an earlier one, so
 * the cuts and the edits are recorded, and the first render makes the cuts, outer first, then the edits in call order.
 */
export function createBlockRewrite(block: ScriptBlock): BlockRewrite {
	const rewrite = createSourceRewrite<IRBlock, TsCodeData>(block);
	const requests: CutRequest[] = [];
	const edits: (() => void)[] = [];
	let flushed = false;
	const flush = () => {
		if (flushed) {
			return;
		}
		flushed = true;
		// the parts that the cuts left, sorted and disjoint; of two cuts of one node, the later is inside the earlier
		const parts: RewritePart<IRBlock, TsCodeData>[] = [rewrite.root];
		const sorted = requests.map((request, index) => ({ request, index }))
			.sort((a, b) => a.request.start - b.request.start || b.request.end - a.request.end || a.index - b.index);
		for (const { request } of sorted) {
			const { start, end, options } = request;
			const index = parts.findIndex(part => part.start <= start && start < part.end && end <= part.end);
			const { before, slice, after } = parts[index]!.cut(start, end, {
				...options,
				placeholder: options.placeholder === undefined ? undefined : resolve(options.placeholder),
			});
			parts.splice(index, 1, before, slice, after);
			request.slice = slice;
		}
		for (const edit of edits) {
			edit();
		}
	};
	const createWriter = (writer: RewriteWriter<IRBlock, TsCodeData>): BlockWriter => {
		const record = (edit: () => void) => {
			if (flushed) {
				edit();
			}
			else {
				edits.push(edit);
			}
		};
		return {
			insertBefore: (offset, code) => record(() => writer.insertBefore(offset, resolve(code))),
			insertAfter: (offset, code) => record(() => writer.insertAfter(offset, resolve(code))),
			replace: (start, end, code) => record(() => writer.replace(start, end, resolve(code))),
			cut(node, options) {
				if (flushed) {
					throw new Error('The rewrite is already rendered.');
				}
				const { start, end } = getStartEnd(node, block.ast);
				const request = new CutRequest(flush, start, end, options);
				requests.push(request);
				return request;
			},
		};
	};
	return {
		...createWriter(rewrite),
		writer: rank => createWriter(rewrite.writer(rank)),
		render(start, end, terminate = true) {
			flush();
			return collect(block, terminate, sink => rewrite.render(start, end, { features: scriptFeatures }, sink));
		},
		renderSlice: (slice, terminate = true) => collect(block, terminate, sink => slice.render(sink)),
		unrendered() {
			const made = new Set<RewriteSlice<IRBlock, TsCodeData>>(rewrite.unrendered());
			return requests.filter(request => !request.slice || made.has(request.slice));
		},
	};
}

function collect(
	block: ScriptBlock,
	terminate: boolean,
	render: (sink: (piece: Piece<{ source: IRBlock; data: TsCodeData }>) => void) => void,
) {
	const out: TsCode[] = [];
	render(piece => {
		out.push(piece);
		if (terminate && typeof piece !== 'string' && piece.text === undefined && piece.source === block) {
			out.push(...generateTerminator(block, piece.start, piece.end));
		}
	});
	return out;
}

/**
 * `code` with the slices of the cuts in place of their requests; a placeholder may hold a cut inside its own, which
 * renders through its request.
 */
function resolve(code: BlockCode): BlockCode {
	if (Array.isArray(code)) {
		return (code as readonly BlockCode[]).map(resolve);
	}
	if (code instanceof CutRequest) {
		return code.slice ?? code;
	}
	return code;
}
