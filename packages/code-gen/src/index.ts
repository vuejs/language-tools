import { Mapping } from '@volar/source-map';
import { ChunkWithData, ChunkWithoutData } from './chunk';

export * from './chunk';

export function buildMappings<T>(chunks: ChunkWithoutData[] | ChunkWithData<T>[]) {
	let length = 0;
	const mappings: Mapping<T>[] = [];
	for (const segment of chunks) {
		if (typeof segment === 'string') {
			length += segment.length;
		}
		else {
			mappings.push({
				generatedRange: [length, length + segment[0].length],
				source: segment[1],
				sourceRange: typeof segment[2] === 'number' ? [segment[2], segment[2] + segment[0].length] : segment[2],
				// @ts-ignore
				data: segment[3],
			});
			length += segment[0].length;
		}
	}
	return mappings;
}
