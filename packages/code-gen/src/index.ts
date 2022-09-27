import { Mapping, MappingKind, MappingRange } from '@volar/source-map';

export class CodeGen<T = undefined> {

	public text = '';
	public mappings: Mapping<T>[] = [];

	public append(str: string): MappingRange;
	public append(str: string, sourceOffset: number, data: T): MappingRange;
	public append(str: string, sourceOffset?: number, data?: T) {
		if (sourceOffset !== undefined && data !== undefined) {
			return this._append(str, { start: sourceOffset, end: sourceOffset + str.length }, MappingKind.Offset, data);
		}
		else {
			return this._append(str);
		}
	}

	// internals
	public _append(str: string, sourceRange?: MappingRange, kind?: MappingKind, data?: T, extraSourceRanges?: MappingRange[]): MappingRange {
		const targetRange = {
			start: this.text.length,
			end: this.text.length + str.length,
		};
		this.text += str;
		if (sourceRange !== undefined && kind !== undefined && data !== undefined) {
			this.mappings.push({
				mappedRange: targetRange,
				sourceRange,
				kind,
				data,
				additional: extraSourceRanges ? extraSourceRanges.map(extraSourceRange => ({
					mappedRange: targetRange,
					kind,
					sourceRange: extraSourceRange,
				})) : undefined,
			});
		}
		return targetRange;
	}
	public _merge<T extends CodeGen<any>>(b: T) {
		const aLength = this.text.length;
		for (const mapping of b.mappings) {
			this.mappings.push({
				...mapping,
				mappedRange: {
					start: mapping.mappedRange.start + aLength,
					end: mapping.mappedRange.end + aLength,
				},
				additional: mapping.additional ? mapping.additional.map(mapping_2 => ({
					...mapping_2,
					mappedRange: {
						start: mapping_2.mappedRange.start + aLength,
						end: mapping_2.mappedRange.end + aLength,
					},
				})) : undefined,
			});
		}
		this.append(b.text);
	}
}
