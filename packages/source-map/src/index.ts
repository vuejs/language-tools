import { computed, shallowRef as ref } from '@vue/reactivity';

export interface Range {
	start: number,
	end: number,
}

export enum Mode {
	/**
	 * @case1
	 * 123456 -> abcdef
	 * ^    ^    ^    ^
	 * @case2
	 * 123456 -> abcdef
	 *  ^  ^      ^  ^
	 * @case3
	 * 123456 -> abcdef
	 *   ^^        ^^
	 */
	Offset,
	/**
	 * @case1
	 * 123456 -> abcdef
	 * ^    ^    ^    ^
	 * @case2
	 * 123456 -> abcdef
	 *  ^  ^     NOT_MATCH
	 * @case3
	 * 123456 -> abcdef
	 *   ^^      NOT_MATCH
	 */
	Totally,
	/**
	 * @case1
	 * 123456 -> abcdef
	 * ^    ^    ^    ^
	 * @case2
	 * 123456 -> abcdef
	 *  ^  ^     ^    ^
	 * @case3
	 * 123456 -> abcdef
	 *   ^^      ^    ^
	 */
	Expand,
}

export type MappingBase = {
	mode: Mode,
	sourceRange: Range,
	mappedRange: Range,
};

export type Mapping<T> = MappingBase & {
	data: T,
	additional?: MappingBase[],
};

export class SourceMapBase<Data = undefined> {

	private __mappings = ref<Mapping<Data>[]>([]);
	private __memo = computed(() => {

		const self = this;
		const source = createMemo('sourceRange');
		const mapped = createMemo('mappedRange');

		return {
			source,
			mapped,
		};

		function createMemo(key: 'mappedRange' | 'sourceRange') {

			const offsets = new Set<number>();

			for (const mapping of self.mappings) {

				offsets.add(mapping[key].start);
				offsets.add(mapping[key].end);

				if (mapping.additional) {
					for (const addition of mapping.additional) {
						offsets.add(addition[key].start);
						offsets.add(addition[key].end);
					}
				}
			}

			const arr: {
				offset: number,
				mappings: Set<Mapping<Data>>,
			}[] = [...offsets].sort((a, b) => a - b).map(offset => ({ offset, mappings: new Set() }));

			for (const mapping of self.mappings) {

				const startIndex = binarySearch(mapping[key].start)!;
				const endIndex = binarySearch(mapping[key].end)!;

				for (let i = startIndex; i <= endIndex; i++) {
					arr[i].mappings.add(mapping);
				}

				if (mapping.additional) {
					for (const addition of mapping.additional) {

						const startIndex = binarySearch(addition[key].start)!;
						const endIndex = binarySearch(addition[key].end)!;

						for (let i = startIndex; i <= endIndex; i++) {
							arr[i].mappings.add(mapping);
						}
					}
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
	});

	public get mappings() {
		return this.__mappings.value;
	}
	public set mappings(value) {
		this.__mappings.value = value;
	}

	constructor(
		_mappings?: Mapping<Data>[],
	) {
		this.mappings = _mappings ?? [];
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

	protected * getRanges(startOffset: number, endOffset: number, sourceToTarget: boolean, filter?: (data: Data) => boolean) {

		const memo = this.__memo.value;
		const _memo = sourceToTarget ? memo.source : memo.mapped;

		if (_memo.length === 0)
			return;

		const {
			low: start,
			high: end,
		} = startOffset === endOffset ? this.binarySearchMemo(_memo, startOffset) : {
			low: this.binarySearchMemo(_memo, startOffset).low,
			high: this.binarySearchMemo(_memo, endOffset).high,
		};
		const skip = new Set<Mapping<Data>>();

		for (let i = start; i <= end; i++) {

			for (const mapping of _memo[i].mappings) {

				if (skip.has(mapping)) {
					continue;
				}
				skip.add(mapping);

				if (filter && !filter(mapping.data))
					continue;

				const mapped = this.getRange(startOffset, endOffset, sourceToTarget, mapping.mode, mapping.sourceRange, mapping.mappedRange, mapping.data);
				if (mapped) {
					yield mapped;
				}
				else if (mapping.additional) {
					for (const other of mapping.additional) {
						const mapped = this.getRange(startOffset, endOffset, sourceToTarget, other.mode, other.sourceRange, other.mappedRange, mapping.data);
						if (mapped) {
							yield mapped;
							break; // only return first match additional range
						}
					}
				}
			}
		}
	}

	private binarySearchMemo(array: typeof this.__memo.value.mapped, start: number) {
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

	private getRange(start: number, end: number, sourceToTarget: boolean, mode: Mode, sourceRange: Range, targetRange: Range, data: Data): [{ start: number, end: number; }, Data] | undefined {
		const mappedToRange = sourceToTarget ? targetRange : sourceRange;
		const mappedFromRange = sourceToTarget ? sourceRange : targetRange;
		if (mode === Mode.Totally) {
			if (start === mappedFromRange.start && end === mappedFromRange.end) {
				const _start = mappedToRange.start;
				const _end = mappedToRange.end;
				return [{
					start: Math.min(_start, _end),
					end: Math.max(_start, _end),
				}, data];
			}
		}
		else if (mode === Mode.Offset) {
			if (start >= mappedFromRange.start && end <= mappedFromRange.end) {
				const _start = mappedToRange.start + start - mappedFromRange.start;
				const _end = mappedToRange.end + end - mappedFromRange.end;
				return [{
					start: Math.min(_start, _end),
					end: Math.max(_start, _end),
				}, data];
			}
		}
		else if (mode === Mode.Expand) {
			if (start >= mappedFromRange.start && end <= mappedFromRange.end) {
				const _start = mappedToRange.start;
				const _end = mappedToRange.end;
				return [{
					start: Math.min(_start, _end),
					end: Math.max(_start, _end),
				}, data];
			}
		}
	}
}
