import type { Mapping, Mode, Range } from '@volar/source-map';

export class CodeGen<T = undefined> {

	private text = '';
	private mappings: Mapping<T>[] = [];

	public getText() {
		return this.text;
	}
	public getMappings(sourceRangeParser?: (data: T, range: Range) => Range): Mapping<T>[] {
		if (!sourceRangeParser) {
			return this.mappings;
		}
		return this.mappings.map(mapping => ({
			...mapping,
			sourceRange: sourceRangeParser(mapping.data, mapping.sourceRange),
			additional: mapping.additional
				? mapping.additional.map(extraMapping => ({
					...extraMapping,
					sourceRange: sourceRangeParser(mapping.data, extraMapping.sourceRange),
				}))
				: undefined,
		}));
	}
	public addCode(str: string, sourceRange: Range, mode: Mode, data: T, extraSourceRanges?: Range[]) {
		const targetRange = this.addText(str);
		this.addMapping2({
			mappedRange: targetRange,
			sourceRange,
			mode,
			data,
			additional: extraSourceRanges ? extraSourceRanges.map(extraSourceRange => ({
				mappedRange: targetRange,
				mode,
				sourceRange: extraSourceRange,
			})) : undefined,
		});
		return targetRange;
	}
	public addMapping(str: string, sourceRange: Range, mode: Mode, data: T) {
		const targetRange = {
			start: this.text.length,
			end: this.text.length + str.length,
		};
		this.addMapping2({ mappedRange: targetRange, sourceRange, mode, data });
		return targetRange;
	}
	public addMapping2(mapping: Mapping<T>) {
		this.mappings.push(mapping);
	}
	public addText(str: string) {
		const range = {
			start: this.text.length,
			end: this.text.length + str.length,
		};
		this.text += str;
		return range;
	}
}

export function mergeCodeGen<T extends CodeGen<any>>(a: T, b: T) {
	const aLength = a.getText().length;
	for (const mapping of b.getMappings()) {
		a.addMapping2({
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
	a.addText(b.getText());
}
