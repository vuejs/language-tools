import { SpanMapKind, type SpanMapSegment } from '@volar/source-map';
/**
 * Generated HTML: plain text, or text copied from an offset of the pug code, of the text's length or of
 * `sourceLength`.
 */
export type PugCode = string | [text: string, offset: number, sourceLength?: number];

export function buildMappings(chunks: PugCode[]) {
	let length = 0;
	const mappings: SpanMapSegment[] = [];
	for (const segment of chunks) {
		if (typeof segment === 'string') {
			length += segment.length;
		}
		else {
			mappings.push({
				virtualStart: length,
				virtualEnd: length + segment[0].length,
				originalStart: segment[1],
				originalEnd: segment[1] + (segment[2] ?? segment[0].length),
				kind: SpanMapKind.Verbatim,
				features: 0,
			});
			length += segment[0].length;
		}
	}
	return mappings;
}
