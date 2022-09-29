
export type Chunk<T = '--'> = T extends '--' ? ChunkWithoutData : ChunkWithData<T>;

export type ChunkWithoutData = [
	string, // text
	string | undefined, // source
	number | [number, number], // source offset
] | string;

export type ChunkWithData<T> = [
	string, // text
	string | undefined, // source
	number | [number, number], // source offset
	T, // data
] | string;

export function getLength(segments: Chunk<any>[]) {
	let length = 0;
	for (const segment of segments) {
		length += typeof segment == 'string' ? segment.length : segment[0].length;
	}
	return length;
}

export function toString(segments: Chunk<any>[]) {
	return segments.map(s => typeof s === 'string' ? s : s[0]).join('');
}
