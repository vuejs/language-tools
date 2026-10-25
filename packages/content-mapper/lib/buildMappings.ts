import { isCompletionEnabled, type Mapping, SpanMapKind } from '@volar/language-core';
import type { VueCodeMarker } from '@vue/language-core';
import { type DiagnosticDirectiveMapping, DiagnosticDirectivePolicy } from '../protocol';
import { isSynthesizedIgnore, OpenRanges, type TsCode } from './boundary';

interface Entry {
	generatedStart: number;
	length: number;
	sourceStart: number;
	info: VueCodeMarker;
}

export function buildMappings(chunks: TsCode[]): Mapping[] {
	return toItems(chunks).flatMap(item => isGroup(item) ? fromGroup(item) : [toMapping(item)]);
}

function fromGroup(group: Entry[]): Mapping[] {
	const first = group[0]!;
	const last = group[group.length - 1]!;
	const atom: Mapping = [
		first.generatedStart,
		last.generatedStart + last.length - first.generatedStart,
		first.sourceStart,
		last.sourceStart + last.length - first.sourceStart,
		isContiguous(group) ? SpanMapKind.Verbatim : SpanMapKind.Atom,
		first.info.features,
	];
	const content = group.length === 3 ? group[1]! : undefined;
	if (
		content
		&& !first.length
		&& !last.length
		&& content.sourceStart === atom[2]
		&& content.length === atom[3]
		&& isCompletionEnabled(content.info.features)
	) {
		atom[5] = 0;
		return [atom, toMapping(content)];
	}
	return [atom];
}

function toMapping({ generatedStart, length, sourceStart, info }: Entry): Mapping {
	return [generatedStart, length, sourceStart, length, info.kind ?? SpanMapKind.Verbatim, info.features];
}

/**
 * The diagnostic directives of the code, with the virtual ranges their bounding segments enclose; the source
 * offset of the segments is the original start, as it is relative to the file here. The generated code
 * whose diagnostics are ignored outside of them is covered by ignore directives without an original range.
 */
export function buildDiagnosticDirectives(chunks: TsCode[]) {
	const directives = collectDiagnosticDirectives(chunks);
	const explicit = checkExplicitDiagnosticDirectives(directives.filter(directive => !isSynthesizedIgnore(directive)));
	const ignored = mergeRanges(
		directives.filter(isSynthesizedIgnore).map<[number, number]>(directive => [directive[2], directive[3]]),
	);
	const ignores = createIgnoreDirectives(ignored, explicit);
	return [...explicit, ...ignores].sort((left, right) => left[2] - right[2] || left[3] - right[3]);
}

/**
 * Ignore directives without an original range over the parts of the virtual ranges, sorted and disjoint, that the
 * directives, disjoint too, leave uncovered.
 */
export function createIgnoreDirectives(
	ranges: [start: number, end: number][],
	directives: readonly DiagnosticDirectiveMapping[],
) {
	const covered = directives
		.map<[number, number]>(directive => [directive[2], directive[3]])
		.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
	return subtractRanges(ranges, covered)
		.map<DiagnosticDirectiveMapping>(([start, end]) => [0, 0, start, end, DiagnosticDirectivePolicy.Ignore]);
}

function collectDiagnosticDirectives(chunks: TsCode[]) {
	const directives: DiagnosticDirectiveMapping[] = [];
	const ranges = new OpenRanges<VueCodeMarker>();
	let generatedStart = 0;
	for (const segment of chunks) {
		if (typeof segment === 'string') {
			generatedStart += segment.length;
			continue;
		}
		const data = segment[3];
		if (data && 'start' in data) {
			if (Array.isArray(data.start)) {
				const [, originalLength, , , policy] = data.start;
				const directive: DiagnosticDirectiveMapping = [
					segment[2],
					originalLength,
					generatedStart,
					generatedStart,
					policy,
				];
				directives.push(directive);
				ranges.start({ directive });
			}
			else {
				ranges.start({ mapping: data.start });
			}
		}
		else if (data && 'end' in data) {
			const directive = ranges.end()?.directive;
			if (directive) {
				directive[3] = generatedStart;
			}
		}
		generatedStart += segment[0].length;
	}
	return directives;
}

function checkExplicitDiagnosticDirectives(directives: DiagnosticDirectiveMapping[]) {
	const result = directives
		.filter(directive => directive[4] === DiagnosticDirectivePolicy.Expect || directive[2] < directive[3])
		.sort((left, right) => left[2] - right[2] || left[3] - right[3]);
	for (let index = 1; index < result.length; index++) {
		const previous = result[index - 1]!;
		const current = result[index]!;
		if (current[2] < previous[3]) {
			throw new Error(
				`Vue diagnostic directive virtual ranges overlap: ${previous[2]}:${previous[3]} and ${current[2]}:${
					current[3]
				}`,
			);
		}
	}
	return result;
}

/**
 * The segments mapping themselves, and the bounded ranges as groups of their bounds and the segments without
 * data they enclose, which carry the data of the range.
 */
function toItems(chunks: TsCode[]) {
	const items: (Entry | Entry[])[] = [];
	const ranges = new OpenRanges<Entry[]>();
	let generatedStart = 0;
	for (const segment of chunks) {
		if (typeof segment === 'string') {
			generatedStart += segment.length;
			continue;
		}
		const [text, , sourceStart, data] = segment;
		if (data === undefined) {
			const range = ranges.mapping;
			if (!range) {
				throw new Error(`Vue generated segment without data outside of a boundary at ${generatedStart}`);
			}
			range.push({ generatedStart, length: text.length, sourceStart, info: range[0]!.info });
		}
		else if ('start' in data) {
			if (Array.isArray(data.start)) {
				ranges.start({ directive: data.start });
			}
			else {
				const range = [{ generatedStart, length: 0, sourceStart, info: data.start }];
				ranges.start({ mapping: range });
				items.push(range);
			}
		}
		else if ('end' in data) {
			const closed = ranges.end();
			if (!closed) {
				throw new Error(`Vue boundary end without a start at ${generatedStart}`);
			}
			closed.mapping?.push({ generatedStart, length: 0, sourceStart, info: closed.mapping[0]!.info });
		}
		else {
			items.push({ generatedStart, length: text.length, sourceStart, info: data });
		}
		generatedStart += text.length;
	}
	if (ranges.size) {
		throw new Error(`Vue boundaries are not closed at the end of the code`);
	}
	return items;
}

function isContiguous(group: Entry[]) {
	const first = group[0]!;
	let generatedEnd = first.generatedStart;
	for (const entry of group) {
		if (
			entry.generatedStart !== generatedEnd
			|| entry.sourceStart - first.sourceStart !== entry.generatedStart - first.generatedStart
		) {
			return false;
		}
		generatedEnd += entry.length;
	}
	return true;
}

function isGroup(item: Entry | Entry[]): item is Entry[] {
	return Array.isArray(item);
}

function mergeRanges(ranges: [number, number][]) {
	const sorted = [...ranges].sort((left, right) => left[0] - right[0]);
	const result: [number, number][] = [];
	for (const range of sorted) {
		const previous = result.at(-1);
		if (previous && range[0] <= previous[1]) {
			previous[1] = Math.max(previous[1], range[1]);
		}
		else {
			result.push([range[0], range[1]]);
		}
	}
	return result;
}

function subtractRanges(ranges: [number, number][], removed: [number, number][]) {
	const result: [number, number][] = [];
	let index = 0;
	for (let [start, end] of ranges) {
		while (index < removed.length && removed[index]![1] <= start) {
			index++;
		}
		for (let i = index; i < removed.length && removed[i]![0] < end; i++) {
			if (removed[i]![0] > start) {
				result.push([start, removed[i]![0]]);
			}
			start = Math.max(start, removed[i]![1]);
		}
		if (start < end) {
			result.push([start, end]);
		}
	}
	return result;
}
