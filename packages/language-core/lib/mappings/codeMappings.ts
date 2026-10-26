import { type Mapping, SpanMapKind } from '@volar/language-core';
import type { Code } from '../types';

/** One mapping per segment with a marker, over the segment's text at its source offset. */
export function buildMappings(chunks: Code[]): Mapping[] {
	const mappings: Mapping[] = [];
	let generatedStart = 0;
	for (const segment of chunks) {
		if (typeof segment === 'string') {
			generatedStart += segment.length;
			continue;
		}
		const [text, , sourceStart, marker] = segment;
		mappings.push([
			generatedStart,
			text.length,
			sourceStart,
			text.length,
			marker.kind ?? SpanMapKind.Verbatim,
			marker.features,
		]);
		generatedStart += text.length;
	}
	return mappings;
}
