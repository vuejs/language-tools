import type { Position } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export { transform as transformCompletionItem } from './transforms/completionItem';
export { transform as transformCompletionList } from './transforms/completionList';
export { transform as transformHover } from './transforms/hover';
export { transform as transformLocations } from './transforms/locationsLike';
export { transform as transformLocation } from './transforms/locationLike';
export { transform as transformTextEdit } from './transforms/textEdit';

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

export class SourceMap<Data = unknown> extends Set<Mapping<Data>> {

	constructor(
		public sourceDocument: TextDocument,
		public mappedDocument: TextDocument,
	) {
		super();
	}

	cache = new Map<string, {
		data: Data;
		start: Position;
		end: Position;
	}[]>();
	cache2 = new Map<string, {
		data: Data;
		start: number;
		end: number;
	}[]>();

	// Range
	public isSourceRange(start: Position, end?: Position) {
		return this.getRanges(start, end ?? start, true, true).length > 0;
	}
	public isMappedRange(start: Position, end?: Position) {
		return this.getRanges(start, end ?? start, false, true).length > 0;
	}
	public getSourceRange(start: Position, end?: Position) {
		const result = this.getRanges(start, end ?? start, false, true);
		if (result.length) return result[0];
	}
	public getMappedRange(start: Position, end?: Position) {
		const result = this.getRanges(start, end ?? start, true, true);
		if (result.length) return result[0];
	}
	public getSourceRanges(start: Position, end?: Position) {
		return this.getRanges(start, end ?? start, false);
	}
	public getMappedRanges(start: Position, end?: Position) {
		return this.getRanges(start, end ?? start, true);
	}
	private getRanges(start: Position, end: Position, sourceToTarget: boolean, returnFirstResult?: boolean) {
		const key = start.line + ':' + start.character + ':' + end.line + ':' + end.character + ':' + sourceToTarget + ':' + returnFirstResult;
		if (this.cache.has(key)) return this.cache.get(key)!;

		const toDoc = sourceToTarget ? this.mappedDocument : this.sourceDocument;
		const fromDoc = sourceToTarget ? this.sourceDocument : this.mappedDocument;
		const startOffset = fromDoc.offsetAt(start);
		const endOffset = fromDoc.offsetAt(end);
		const result = this
			.getRanges2(startOffset, endOffset, sourceToTarget, returnFirstResult)
			.map(result => ({
				data: result.data,
				start: toDoc.positionAt(result.start),
				end: toDoc.positionAt(result.end),
			}));
		this.cache.set(key, result);
		return result;
	}

	// MapedRange
	public isSourceRange2(start: number, end?: number) {
		return this.getRanges2(start, end ?? start, true, true).length > 0;
	}
	public isMappedRange2(start: number, end?: number) {
		return this.getRanges2(start, end ?? start, false, true).length > 0;
	}
	public getSourceRange2(start: number, end?: number) {
		const result = this.getRanges2(start, end ?? start, false, true);
		if (result.length) return result[0];
	}
	public getMappedRange2(start: number, end?: number) {
		const result = this.getRanges2(start, end ?? start, true, true);
		if (result.length) return result[0];
	}
	public getSourceRanges2(start: number, end?: number) {
		return this.getRanges2(start, end ?? start, false);
	}
	public getMappedRanges2(start: number, end?: number) {
		return this.getRanges2(start, end ?? start, true);
	}
	private getRanges2(start: number, end: number, sourceToTarget: boolean, returnFirstResult?: boolean) {
		const key = start + ':' + end + ':' + sourceToTarget + ':' + returnFirstResult;
		if (this.cache2.has(key)) return this.cache2.get(key)!;

		let result: {
			data: Data,
			start: number,
			end: number,
		}[] = [];

		for (const mapping of this) {
			const maped = this.getRange(start, end, sourceToTarget, mapping.mode, mapping.sourceRange, mapping.mappedRange, mapping.data);
			if (maped) {
				result.push(maped);
				if (returnFirstResult) return result;
			}
			if (mapping.additional) {
				for (const other of mapping.additional) {
					const maped = this.getRange(start, end, sourceToTarget, other.mode, other.sourceRange, other.mappedRange, mapping.data);
					if (maped) {
						result.push(maped);
						if (returnFirstResult) return result;
					}
				}
			}
		}
		this.cache2.set(key, result);

		return result;
	}

	private getRange(start: number, end: number, sourceToTarget: boolean, mode: Mode, sourceRange: Range, targetRange: Range, data: Data) {
		const mapedToRange = sourceToTarget ? targetRange : sourceRange;
		const mapedFromRange = sourceToTarget ? sourceRange : targetRange;
		if (mode === Mode.Totally) {
			if (start === mapedFromRange.start && end === mapedFromRange.end) {
				const _start = mapedToRange.start;
				const _end = mapedToRange.end;
				return {
					data: data,
					start: Math.min(_start, _end),
					end: Math.max(_start, _end),
				};
			}
		}
		else if (mode === Mode.Offset) {
			if (start >= mapedFromRange.start && end <= mapedFromRange.end) {
				const _start = mapedToRange.start + start - mapedFromRange.start;
				const _end = mapedToRange.end + end - mapedFromRange.end;
				return {
					data: data,
					start: Math.min(_start, _end),
					end: Math.max(_start, _end),
				};
			}
		}
		else if (mode === Mode.Expand) {
			if (start >= mapedFromRange.start && end <= mapedFromRange.end) {
				const _start = mapedToRange.start;
				const _end = mapedToRange.end;
				return {
					data: data,
					start: Math.min(_start, _end),
					end: Math.max(_start, _end),
				};
			}
		}
	}
}

export type ScriptGenerator = ReturnType<typeof createScriptGenerator>;

export function createScriptGenerator<T = undefined>() {

	let text = '';
	const mappings: Mapping<T>[] = [];

	return {
		getText: () => text,
		getMappings: () => mappings,
		addText,
		addCode,
		addMapping,
		addMapping2,
	}

	function addCode(str: string, sourceRange: Range, mode: Mode, data: T) {
		const targetRange = addText(str);
		addMapping2({ mappedRange: targetRange, sourceRange, mode, data });
		return targetRange;
	}
	function addMapping(str: string, sourceRange: Range, mode: Mode, data: T) {
		const targetRange = {
			start: text.length,
			end: text.length + str.length,
		};
		addMapping2({ mappedRange: targetRange, sourceRange, mode, data });
		return targetRange;
	}
	function addMapping2(mapping: Mapping<T>) {
		mappings.push(mapping);
	}
	function addText(str: string) {
		const range = {
			start: text.length,
			end: text.length + str.length,
		};
		text += str;
		return range;
	}
}
