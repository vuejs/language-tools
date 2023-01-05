import { SegmentWithData, SegmentWithoutData } from 'muggle-string';

export * from 'muggle-string';

export interface Mapping<T = any> {
	source?: string;
	sourceRange: [number, number];
	generatedRange: [number, number];
	data: T;
};

export class SourceMap<Data = any> {

	private _memo: {
		sourceRange: {
			offset: number;
			mappings: Set<Mapping<Data>>;
		}[];
		generatedRange: {
			offset: number;
			mappings: Set<Mapping<Data>>;
		}[];
	} | undefined;

	private get memo() {
		if (!this._memo) {

			const self = this;
			this._memo = {
				sourceRange: createMemo('sourceRange'),
				generatedRange: createMemo('generatedRange'),
			};

			function createMemo(key: 'sourceRange' | 'generatedRange') {

				const offsets = new Set<number>();

				for (const mapping of self.mappings) {
					offsets.add(mapping[key][0]);
					offsets.add(mapping[key][1]);
				}

				const arr: {
					offset: number,
					mappings: Set<Mapping<Data>>,
				}[] = [...offsets].sort((a, b) => a - b).map(offset => ({ offset, mappings: new Set() }));

				for (const mapping of self.mappings) {

					const startIndex = binarySearch(mapping[key][0])!;
					const endIndex = binarySearch(mapping[key][1])!;

					for (let i = startIndex; i <= endIndex; i++) {
						arr[i].mappings.add(mapping);
					}
				}

				return arr;

				function binarySearch(start: number) {
					let low = 0;
					let high = arr.length - 1;
					while (low <= high) {
						const mid = Math.floor((low + high) / 2);
						const midValue = arr[mid];
						if (midValue.offset < start) {
							low = mid + 1;
						}
						else if (midValue.offset > start) {
							high = mid - 1;
						}
						else {
							return mid;
						}
					}
				}
			}
		}
		return this._memo;
	}

	constructor(public readonly mappings: Mapping<Data>[]) { }

	public toSourceOffset(start: number, baseOnRight: boolean = false) {
		for (const mapped of this.matching(start, 'generatedRange', 'sourceRange', baseOnRight)) {
			return mapped;
		}
	}

	public toGeneratedOffset(start: number, baseOnRight: boolean = false) {
		for (const mapped of this.matching(start, 'sourceRange', 'generatedRange', baseOnRight)) {
			return mapped;
		}
	}

	public toSourceOffsets(start: number, baseOnRight: boolean = false) {
		return this.matching(start, 'generatedRange', 'sourceRange', baseOnRight);
	}

	public toGeneratedOffsets(start: number, baseOnRight: boolean = false) {
		return this.matching(start, 'sourceRange', 'generatedRange', baseOnRight);
	}

	public * matching(startOffset: number, from: 'sourceRange' | 'generatedRange', to: 'sourceRange' | 'generatedRange', baseOnRight: boolean) {

		const memo = this.memo[from];

		if (memo.length === 0)
			return;

		const {
			low: start,
			high: end,
		} = this.binarySearchMemo(memo, startOffset);
		const skip = new Set<Mapping<Data>>();

		for (let i = start; i <= end; i++) {

			for (const mapping of memo[i].mappings) {

				if (skip.has(mapping)) {
					continue;
				}
				skip.add(mapping);

				const mapped = this.matchOffset(startOffset, mapping[from], mapping[to], baseOnRight);
				if (mapped !== undefined) {
					yield [mapped, mapping] as const;
				}
			}
		}
	}

	public matchOffset(start: number, mappedFromRange: [number, number], mappedToRange: [number, number], baseOnRight: boolean): number | undefined {
		if (start >= mappedFromRange[0] && start <= mappedFromRange[1]) {
			let offset = mappedToRange[0] + start - mappedFromRange[0];
			if (baseOnRight) {
				offset += (mappedToRange[1] - mappedToRange[0]) - (mappedFromRange[1] - mappedFromRange[0]);
			}
			return offset;
		}
	}

	private binarySearchMemo(array: typeof this.memo['sourceRange'], start: number) {
		let low = 0;
		let high = array.length - 1;
		while (low <= high) {
			const mid = Math.floor((low + high) / 2);
			const midValue = array[mid];
			if (midValue.offset < start) {
				low = mid + 1;
			}
			else if (midValue.offset > start) {
				high = mid - 1;
			}
			else {
				low = mid;
				high = mid;
				break;
			}
		}
		return {
			low: Math.max(Math.min(low, high, array.length - 1), 0),
			high: Math.min(Math.max(low, high, 0), array.length - 1),
		};
	}
}

export function buildMappings<T>(chunks: SegmentWithoutData[] | SegmentWithData<T>[]) {
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
