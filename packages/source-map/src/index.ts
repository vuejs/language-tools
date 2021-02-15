import type { Position } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export { transform as transformCompletionList } from './transforms/completionList';
export { transform as transformHover } from './transforms/hover';
export { transform as transformLocations } from './transforms/locationsLike';
export { transform as transformTextEdit } from './transforms/textEdit';
export { transform as transformTextEdits } from './transforms/textEdits';

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
		const toDoc = sourceToTarget ? this.targetDocument : this.sourceDocument;
		const fromDoc = sourceToTarget ? this.sourceDocument : this.targetDocument;
		const startOffset = fromDoc.offsetAt(start);
		const endOffset = fromDoc.offsetAt(end);
		return this
			.maps2(startOffset, endOffset, sourceToTarget, returnFirstResult)
			.map(result => ({
				data: result.data,
				start: toDoc.positionAt(result.start),
				end: toDoc.positionAt(result.end),
			}));
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
		const result: {
			data: MapedData,
			start: number,
			end: number,
		}[] = [];
		for (const maped of this) {
			const ranges = [{
				mode: maped.mode,
				sourceRange: maped.sourceRange,
				targetRange: maped.targetRange,
			}, ...maped.others ?? []];
			for (const maped_2 of ranges) {
				const mapedToRange = sourceToTarget ? maped_2.targetRange : maped_2.sourceRange;
				const mapedFromRange = sourceToTarget ? maped_2.sourceRange : maped_2.targetRange;
				if (maped_2.mode === MapedMode.Gate) {
					if (start === mapedFromRange.start && end === mapedFromRange.end) {
						const offsets = [mapedToRange.start, mapedToRange.end];
						result.push({
							data: maped.data,
							start: Math.min(offsets[0], offsets[1]),
							end: Math.max(offsets[0], offsets[1]),
						});
						if (returnFirstResult) return result;
						break;
					}
				}
				else if (maped_2.mode === MapedMode.Offset) {
					if (start >= mapedFromRange.start && end <= mapedFromRange.end) {
						const offsets = [mapedToRange.start + start - mapedFromRange.start, mapedToRange.end + end - mapedFromRange.end];
						result.push({
							data: maped.data,
							start: Math.min(offsets[0], offsets[1]),
							end: Math.max(offsets[0], offsets[1]),
						});
						if (returnFirstResult) return result;
						break;
					}
				}
				else if (maped_2.mode === MapedMode.In) {
					if (start >= mapedFromRange.start && end <= mapedFromRange.end) {
						const offsets = [mapedToRange.start, mapedToRange.end];
						result.push({
							data: maped.data,
							start: Math.min(offsets[0], offsets[1]),
							end: Math.max(offsets[0], offsets[1]),
						});
						if (returnFirstResult) return result;
						break;
					}
				}
			}
		}
		return result;
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
