import { type Mapping, SpanMapKind } from '@volar/source-map';
import type { Segment } from 'muggle-string';

export function buildMappings(chunks: Segment<any>[]) {
	let length = 0;
	const mappings: Mapping[] = [];
	for (const segment of chunks) {
		if (typeof segment === 'string') {
			length += segment.length;
		}
		else {
			mappings.push([length, segment[0].length, segment[2], segment[0].length, SpanMapKind.Verbatim, 0]);
			length += segment[0].length;
		}
	}
	return mappings;
}
