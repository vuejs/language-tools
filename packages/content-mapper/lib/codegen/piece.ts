import type { CodeSource } from '@vue/language-core';
import type { RewriteSink } from 'muggle-string';
import { Boundary, type TsCode } from './tsCode';

/**
 * Generated code as plain data: new text, which maps nowhere, or the range `start`..`end` of `source` with the `data`
 * it maps by. A range without `text` is a copy of the source text there; `text` is generated text that maps to the
 * range without being a copy of it. An empty range is an anchor. A structural type: any producer can emit it.
 */
export type Piece<Source, Data> = string | { source: Source; start: number; end: number; data: Data; text?: string };

/** The data of a segment of generated TypeScript code. */
export type TsCodeData = Exclude<TsCode, string>[3];

/** A piece of generated TypeScript code; a copy needs a block as its source. */
export type TsPiece = Piece<CodeSource, TsCodeData>;

/** The muggle-string sink that appends to `out` the pieces a rewrite renders: copies, generated text and segments. */
export function pieceSink<Source, Data>(out: Piece<Source, Data>[]): RewriteSink<Source, Data> {
	return {
		text: text => out.push(text),
		source: (rewrite, start, end, data) => out.push({ source: rewrite.source, start, end, data }),
		segment: ([text, source, offset, data]) =>
			out.push({ source, start: offset, end: offset + text.length, data, text }),
	};
}

/** The code of `piece`. A range whose text is not as long as the range maps as a whole, by a boundary around it. */
export function* generatePiece(piece: TsPiece): Generator<TsCode> {
	if (typeof piece === 'string') {
		if (piece) {
			yield piece;
		}
		return;
	}
	const { source, start, end, data } = piece;
	const text = piece.text ?? source!.content.slice(start, end);
	if (text.length === end - start || data === undefined || !('features' in data)) {
		yield [text, source, start, data];
		return;
	}
	const boundary = yield* Boundary.start(source, start, end, data);
	yield text;
	yield boundary.end();
}

export function* generatePieces(pieces: Iterable<TsPiece>): Generator<TsCode> {
	for (const piece of pieces) {
		yield* generatePiece(piece);
	}
}
