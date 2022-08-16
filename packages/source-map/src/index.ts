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

	public mappings: Mapping<Data>[];

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

		for (const mapping of this.mappings) {

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
