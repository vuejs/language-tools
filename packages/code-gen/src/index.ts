import type { Mapping, Mode, Range } from '@volar/source-map';

export type CodeGen = ReturnType<typeof createCodeGen>;

export function createCodeGen<T = undefined>() {

	let text = '';
	const mappings: Mapping<T>[] = [];

	return {
		getText: () => text,
		getMappings,
		addText,
		addCode,
		addMapping,
		addMapping2,
	}

	function getMappings(sourceRangeParser?: (data: T, range: Range) => Range): Mapping<T>[] {
		if (!sourceRangeParser) {
			return mappings;
		}
		return mappings.map(mapping => ({
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
	function addCode(str: string, sourceRange: Range, mode: Mode, data: T, extraSourceRanges?: Range[]) {
		const targetRange = addText(str);
		addMapping2({
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

export function margeCodeGen<T extends CodeGen>(a: T, b: T) {
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
