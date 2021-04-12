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
