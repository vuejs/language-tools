import type { TextDocument } from 'vscode-languageserver-textdocument';
import type * as vscode from 'vscode-languageserver';

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
}

export type Mapping<T> = MappingBase & {
	data: T,
	additional?: MappingBase[],
}

export class SourceMapBase<Data = undefined> {

	mappings: Mapping<Data>[];

	constructor(
		_mappings?: Mapping<Data>[],

	) {
		this.mappings = _mappings ?? [];
	}

	public getSourceRange(start: number, end?: number, filter?: (data: Data) => boolean) {
		for (const maped of this.getRanges(start, end ?? start, false, filter)) {
			return maped;
		}
	}
	public getMappedRange(start: number, end?: number, filter?: (data: Data) => boolean) {
		for (const maped of this.getRanges(start, end ?? start, true, filter)) {
			return maped;
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

			const maped = this.getRange(startOffset, endOffset, sourceToTarget, mapping.mode, mapping.sourceRange, mapping.mappedRange, mapping.data);
			if (maped) {
				yield getMaped(maped);
			}
			else if (mapping.additional) {
				for (const other of mapping.additional) {
					const maped = this.getRange(startOffset, endOffset, sourceToTarget, other.mode, other.sourceRange, other.mappedRange, mapping.data);
					if (maped) {
						yield getMaped(maped);
						break; // only return first match additional range
					}
				}
			}
		}

		function getMaped(maped: [{ start: number, end: number }, Data]) {
			return maped;
		}
	}

	private getRange(start: number, end: number, sourceToTarget: boolean, mode: Mode, sourceRange: Range, targetRange: Range, data: Data): [{ start: number, end: number }, Data] | undefined {
		const mapedToRange = sourceToTarget ? targetRange : sourceRange;
		const mapedFromRange = sourceToTarget ? sourceRange : targetRange;
		if (mode === Mode.Totally) {
			if (start === mapedFromRange.start && end === mapedFromRange.end) {
				const _start = mapedToRange.start;
				const _end = mapedToRange.end;
				return [{
					start: Math.min(_start, _end),
					end: Math.max(_start, _end),
				}, data];
			}
		}
		else if (mode === Mode.Offset) {
			if (start >= mapedFromRange.start && end <= mapedFromRange.end) {
				const _start = mapedToRange.start + start - mapedFromRange.start;
				const _end = mapedToRange.end + end - mapedFromRange.end;
				return [{
					start: Math.min(_start, _end),
					end: Math.max(_start, _end),
				}, data];
			}
		}
		else if (mode === Mode.Expand) {
			if (start >= mapedFromRange.start && end <= mapedFromRange.end) {
				const _start = mapedToRange.start;
				const _end = mapedToRange.end;
				return [{
					start: Math.min(_start, _end),
					end: Math.max(_start, _end),
				}, data];
			}
		}
	}
}

export class SourceMap<Data = undefined> extends SourceMapBase<Data> {

	constructor(
		public sourceDocument: TextDocument,
		public mappedDocument: TextDocument,
		public _mappings?: Mapping<Data>[],
	) {
		super(_mappings);
	}

	public getSourceRange<T extends number | vscode.Position>(start: T, end?: T, filter?: (data: Data) => boolean) {
		for (const maped of this.getRanges(start, end ?? start, false, filter)) {
			return maped;
		}
	}
	public getMappedRange<T extends number | vscode.Position>(start: T, end?: T, filter?: (data: Data) => boolean) {
		for (const maped of this.getRanges(start, end ?? start, true, filter)) {
			return maped;
		}
	}
	public getSourceRanges<T extends number | vscode.Position>(start: T, end?: T, filter?: (data: Data) => boolean) {
		return this.getRanges(start, end ?? start, false, filter);
	}
	public getMappedRanges<T extends number | vscode.Position>(start: T, end?: T, filter?: (data: Data) => boolean) {
		return this.getRanges(start, end ?? start, true, filter);
	}

	protected * getRanges<T extends number | vscode.Position>(start: T, end: T, sourceToTarget: boolean, filter?: (data: Data) => boolean) {

		const startIsNumber = typeof start === 'number';
		const endIsNumber = typeof end === 'number';

		const toDoc = sourceToTarget ? this.mappedDocument : this.sourceDocument;
		const fromDoc = sourceToTarget ? this.sourceDocument : this.mappedDocument;
		const startOffset = startIsNumber ? start : fromDoc.offsetAt(start);
		const endOffset = endIsNumber ? end : fromDoc.offsetAt(end);

		for (const maped of super.getRanges(startOffset, endOffset, sourceToTarget, filter)) {
			yield getMaped(maped);
		}

		function getMaped(maped: [{ start: number, end: number }, Data]): [{ start: T, end: T }, Data] {
			if (startIsNumber) {
				return maped as [{ start: T, end: T }, Data];
			}
			return [{
				start: toDoc.positionAt(maped[0].start) as T,
				end: toDoc.positionAt(maped[0].end) as T,
			}, maped[1]];
		}
	}
}
