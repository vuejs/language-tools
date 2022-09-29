export interface Mapping<T = any> {
	source?: string;
	sourceRange: [number, number];
	generatedRange: [number, number];
	data: T;
};

export class SourceMapBase<Data = undefined> {

	private _memo: {
		offset: number;
		mappings: Set<Mapping<Data>>;
	}[][] | undefined;
	private get memo() {
		if (!this._memo) {

			const self = this;
			const source = createMemo('sourceRange');
			const mapped = createMemo('generatedRange');
			this._memo = [source, mapped];

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

	constructor(public mappings: Mapping<Data>[]) {
	}

	public getSourceRange(start: number, end?: number, filter?: (data: Data) => boolean) {
		for (const mapped of this.getRanges(start, end ?? start, false, filter)) {
			return mapped;
		}
	}
	public getMappedRange(start: number, end?: number, filter?: (data: Data) => boolean) {
		for (const mapped of this.getRanges(start, end ?? start, true, filter)) {
			return mapped;
		}
	}
	public getSourceRanges(start: number, end?: number, filter?: (data: Data) => boolean) {
		return this.getRanges(start, end ?? start, false, filter);
	}
	public getMappedRanges(start: number, end?: number, filter?: (data: Data) => boolean) {
		return this.getRanges(start, end ?? start, true, filter);
	}

	public * getRanges(startOffset: number, endOffset: number, sourceToTarget: boolean, filter?: (data: Data) => boolean) {

		const memo = sourceToTarget ? this.memo[0] : this.memo[1];

		if (memo.length === 0)
			return;

		const {
			low: start,
			high: end,
		} = startOffset === endOffset ? this.binarySearchMemo(memo, startOffset) : {
			low: this.binarySearchMemo(memo, startOffset).low,
			high: this.binarySearchMemo(memo, endOffset).high,
		};
		const skip = new Set<Mapping<Data>>();

		for (let i = start; i <= end; i++) {

			for (const mapping of memo[i].mappings) {

				if (skip.has(mapping)) {
					continue;
				}
				skip.add(mapping);

				if (filter && !filter(mapping.data))
					continue;

				const mapped = this.getRange(startOffset, endOffset, sourceToTarget, mapping.sourceRange, mapping.generatedRange, mapping.data);
				if (mapped) {
					yield mapped;
				}
			}
		}
	}

	private binarySearchMemo(array: typeof this.memo[number], start: number) {
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

	private getRange(start: number, end: number, sourceToTarget: boolean, sourceRange: [number, number], targetRange: [number, number], data: Data): [{ start: number, end: number; }, Data] | undefined {
		const mappedToRange = sourceToTarget ? targetRange : sourceRange;
		const mappedFromRange = sourceToTarget ? sourceRange : targetRange;
		if (start >= mappedFromRange[0] && end <= mappedFromRange[1]) {
			const _start = mappedToRange[0] + start - mappedFromRange[0];
			const _end = mappedToRange[1] + end - mappedFromRange[1];
			return [{
				start: Math.min(_start, _end),
				end: Math.max(_start, _end),
			}, data];
		}
	}
}
