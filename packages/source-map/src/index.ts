import type { Position } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export { transform as transformCompletionItem } from './transforms/completionItem';
export { transform as transformCompletionList } from './transforms/completionList';
export { transform as transformHover } from './transforms/hover';
export { transform as transformLocations } from './transforms/locationsLike';
export { transform as transformLocation } from './transforms/locationLike';
export { transform as transformTextEdit } from './transforms/textEdit';

export interface MapedRange {
	start: number,
	end: number,
}

export enum MapedMode {
	Offset,
	Gate,
	In,
}

export type Mapping<T> = {
	data: T,
	mode: MapedMode,
	sourceRange: MapedRange,
	targetRange: MapedRange,
	others?: {
		mode: MapedMode,
		sourceRange: MapedRange,
		targetRange: MapedRange,
	}[],
}

export class SourceMap<MapedData = unknown> extends Set<Mapping<MapedData>> {

	constructor(
		public sourceDocument: TextDocument,
		public targetDocument: TextDocument,
	) {
		super();
	}

	cache = new Map<string, {
		data: MapedData;
		start: Position;
		end: Position;
	}[]>();
	cache2 = new Map<string, {
		data: MapedData;
		start: number;
		end: number;
	}[]>();

	// Range
	public isSource(start: Position, end?: Position) {
		return this.maps(start, end ?? start, true, true).length > 0;
	}
	public isTarget(start: Position, end?: Position) {
		return this.maps(start, end ?? start, false, true).length > 0;
	}
	public targetToSource(start: Position, end?: Position) {
		const result = this.maps(start, end ?? start, false, true);
		if (result.length) return result[0];
	}
	public sourceToTarget(start: Position, end?: Position) {
		const result = this.maps(start, end ?? start, true, true);
		if (result.length) return result[0];
	}
	public targetToSources(start: Position, end?: Position) {
		return this.maps(start, end ?? start, false);
	}
	public sourceToTargets(start: Position, end?: Position) {
		return this.maps(start, end ?? start, true);
	}
	private maps(start: Position, end: Position, sourceToTarget: boolean, returnFirstResult?: boolean) {
		const key = start.line + ':' + start.character + ':' + end.line + ':' + end.character + ':' + sourceToTarget + ':' + returnFirstResult;
		if (this.cache.has(key)) return this.cache.get(key)!;

		const toDoc = sourceToTarget ? this.targetDocument : this.sourceDocument;
		const fromDoc = sourceToTarget ? this.sourceDocument : this.targetDocument;
		const startOffset = fromDoc.offsetAt(start);
		const endOffset = fromDoc.offsetAt(end);
		const result = this
			.maps2(startOffset, endOffset, sourceToTarget, returnFirstResult)
			.map(result => ({
				data: result.data,
				start: toDoc.positionAt(result.start),
				end: toDoc.positionAt(result.end),
			}));
		this.cache.set(key, result);
		return result;
	}

	// MapedRange
	public isSource2(start: number, end?: number) {
		return this.maps2(start, end ?? start, true, true).length > 0;
	}
	public isTarget2(start: number, end?: number) {
		return this.maps2(start, end ?? start, false, true).length > 0;
	}
	public targetToSource2(start: number, end?: number) {
		const result = this.maps2(start, end ?? start, false, true);
		if (result.length) return result[0];
	}
	public sourceToTarget2(start: number, end?: number) {
		const result = this.maps2(start, end ?? start, true, true);
		if (result.length) return result[0];
	}
	public targetToSources2(start: number, end?: number) {
		return this.maps2(start, end ?? start, false);
	}
	public sourceToTargets2(start: number, end?: number) {
		return this.maps2(start, end ?? start, true);
	}
	private maps2(start: number, end: number, sourceToTarget: boolean, returnFirstResult?: boolean) {
		const key = start + ':' + end + ':' + sourceToTarget + ':' + returnFirstResult;
		if (this.cache2.has(key)) return this.cache2.get(key)!;

		const result: {
			data: MapedData,
			start: number,
			end: number,
		}[] = [];
		for (const maped of this) {
			const _result = tryMapping(maped.mode, maped.sourceRange, maped.targetRange, maped.data);
			if (_result) {
				result.push(_result);
				if (returnFirstResult) return result;
			}
			if (maped.others) {
				for (const other of maped.others) {
					const _result = tryMapping(other.mode, other.sourceRange, other.targetRange, maped.data);
					if (_result) {
						result.push(_result);
						if (returnFirstResult) return result;
					}
				}
			}
		}
		this.cache2.set(key, result);
		return result;

		function tryMapping(mode: MapedMode, sourceRange: MapedRange, targetRange: MapedRange, data: MapedData) {
			const mapedToRange = sourceToTarget ? targetRange : sourceRange;
			const mapedFromRange = sourceToTarget ? sourceRange : targetRange;
			if (mode === MapedMode.Gate) {
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
			else if (mode === MapedMode.Offset) {
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
			else if (mode === MapedMode.In) {
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

	function addCode(str: string, sourceRange: MapedRange, mode: MapedMode, data: T) {
		const targetRange = addText(str);
		addMapping2({ targetRange, sourceRange, mode, data });
		return targetRange;
	}
	function addMapping(str: string, sourceRange: MapedRange, mode: MapedMode, data: T) {
		const targetRange = {
			start: text.length,
			end: text.length + str.length,
		};
		addMapping2({ targetRange, sourceRange, mode, data });
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
