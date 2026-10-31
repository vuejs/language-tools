import { SpanMapKind, type SpanMapSegment } from '@volar/language-core';
import { rewritePieceText } from 'muggle-string';
import type { Code } from '../types';

/** One span map segment per piece with a marker, from the piece's text to its range. */
export function buildMappings(chunks: Code[]): SpanMapSegment[] {
	const mappings: SpanMapSegment[] = [];
	let generatedStart = 0;
	for (const piece of chunks) {
		const { length } = rewritePieceText(piece);
		if (typeof piece !== 'string') {
			const { start, end, data } = piece;
			mappings.push({
				virtualStart: generatedStart,
				virtualEnd: generatedStart + length,
				originalStart: start,
				originalEnd: end,
				kind: data.kind ?? (length === end - start ? SpanMapKind.Verbatim : SpanMapKind.Atom),
				features: data.features,
			});
		}
		generatedStart += length;
	}
	return mappings;
}
