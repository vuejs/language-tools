import { SpanMapKind, type SpanMapSegment } from '@volar/source-map';
import type { PugParseResult } from 'muggle-pug';

/** The mappings from the HTML of `pieces` to the pug code. */
export function buildMappings(pieces: PugParseResult['pieces']) {
	let length = 0;
	const mappings: SpanMapSegment[] = [];
	for (const piece of pieces) {
		if (typeof piece === 'string') {
			length += piece.length;
			continue;
		}
		const { start, end } = piece;
		const htmlLength = piece.text?.length ?? end - start;
		mappings.push({
			virtualStart: length,
			virtualEnd: length + htmlLength,
			originalStart: start,
			originalEnd: end,
			kind: SpanMapKind.Verbatim,
			features: 0,
		});
		length += htmlLength;
	}
	return mappings;
}
