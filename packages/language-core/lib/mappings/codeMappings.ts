import { SpanMapKind, type SpanMapSegment } from '@volar/language-core';
import type { Code } from '../types';

/** One span map segment per code segment with a marker, over the segment's text at its source offset. */
export function buildMappings(chunks: Code[]): SpanMapSegment[] {
	const mappings: SpanMapSegment[] = [];
	let generatedStart = 0;
	for (const segment of chunks) {
		if (typeof segment === 'string') {
			generatedStart += segment.length;
			continue;
		}
		const [text, , sourceStart, marker] = segment;
		mappings.push({
			virtualStart: generatedStart,
			virtualEnd: generatedStart + text.length,
			originalStart: sourceStart,
			originalEnd: sourceStart + text.length,
			kind: marker.kind ?? SpanMapKind.Verbatim,
			features: marker.features,
		});
		generatedStart += text.length;
	}
	return mappings;
}
