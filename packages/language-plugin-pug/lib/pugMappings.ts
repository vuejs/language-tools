import { SpanMapKind, type SpanMapSegment } from '@volar/source-map';
import type { PugSegment } from 'muggle-pug';

/** The mappings from the HTML of `segments` to the pug code. */
export function buildMappings(segments: PugSegment[]) {
	let length = 0;
	const mappings: SpanMapSegment[] = [];
	for (const segment of segments) {
		if (typeof segment === 'string') {
			length += segment.length;
		}
		else {
			mappings.push({
				virtualStart: length,
				virtualEnd: length + segment[0].length,
				originalStart: segment[2],
				originalEnd: segment[2] + segment[3],
				kind: SpanMapKind.Verbatim,
				features: 0,
			});
			length += segment[0].length;
		}
	}
	return mappings;
}
