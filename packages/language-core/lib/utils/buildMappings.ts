import { isCompletionEnabled, type Mapping, SpanMapKind } from '@volar/language-core';
import { allFeatures } from '../codegen/features';
import { type Code, type DiagnosticDirectiveMapping, DiagnosticDirectivePolicy, type VueCodeMarker } from '../types';

interface Entry {
	generatedStart: number;
	length: number;
	sourceStart: number;
	info: VueCodeMarker;
}

interface Span {
	mapping: Mapping;
	ignoreDiagnostics: boolean;
}

export function buildMappings(chunks: Code[]): Mapping[] {
	return buildSpans(chunks).map(span => span.mapping);
}

/** Generated ranges whose diagnostics are not reported, sorted and disjoint. */
function getIgnoredRanges(chunks: Code[]) {
	const ignored: [start: number, end: number][] = [];
	const reported: [start: number, end: number][] = [];
	const fills: Span[] = [];
	const originals = new Set<string>();
	const originalRanges: [start: number, end: number][] = [];
	for (const span of buildSpans(chunks)) {
		const [start, length, originalStart, originalLength, kind, features] = span.mapping;
		if (!length) {
			continue;
		}
		if (isFill(kind, features)) {
			fills.push(span);
			continue;
		}
		(span.ignoreDiagnostics ? ignored : reported).push([start, start + length]);
		addOriginal(originalStart, originalStart + originalLength);
	}
	let owned = mergeRanges([...ignored, ...reported]);
	const ignoredRanges = subtractRanges(mergeRanges(ignored), mergeRanges(reported));

	// A fill only takes the parts no other segment owns, and is dropped when its
	// original range crosses one already taken, so its diagnostics fall to the outer segment.
	fills.sort((left, right) => left.mapping[1] - right.mapping[1]);
	for (const { mapping: [start, length, originalStart, originalLength], ignoreDiagnostics } of fills) {
		const originalEnd = originalStart + originalLength;
		if (!canAddOriginal(originalStart, originalEnd)) {
			continue;
		}
		const free = subtractRanges([[start, start + length]], owned);
		if (!free.length) {
			continue;
		}
		if (ignoreDiagnostics) {
			ignoredRanges.push(...free);
		}
		owned = mergeRanges([...owned, ...free]);
		addOriginal(originalStart, originalEnd);
	}
	return mergeRanges(ignoredRanges);

	function addOriginal(start: number, end: number) {
		if (start < end) {
			originals.add(`${start}:${end}`);
			originalRanges.push([start, end]);
		}
	}

	function canAddOriginal(start: number, end: number) {
		return originals.has(`${start}:${end}`)
			|| !originalRanges.some(range => start < range[1] && range[0] < end);
	}
}

function buildSpans(chunks: Code[]): Span[] {
	const items = toItems(chunks);
	const shorthandRanges = new Set<string>();
	for (const item of items) {
		if (!isGroup(item)) {
			if (item.info.kind === SpanMapKind.Atom) {
				shorthandRanges.add(`${item.sourceStart}:${item.sourceStart + item.length}`);
			}
		}
		else if (item[0]!.info.kind === SpanMapKind.Atom) {
			for (const { sourceStart, length } of item.slice(1, -1)) {
				shorthandRanges.add(`${sourceStart}:${sourceStart + length}`);
			}
		}
	}

	return items.flatMap(item => isGroup(item) ? fromGroup(item) : [toSpan(item)]);

	function fromGroup(group: Entry[]): Span[] {
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
		const span = { mapping: atom, ignoreDiagnostics: !!first.info.ignoreDiagnostics };
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
			return [span, toSpan(content)];
		}
		return [span];
	}

	function toSpan({ generatedStart, length, sourceStart, info }: Entry): Span {
		const kind = info.kind !== undefined
			? info.kind
			: shorthandRanges.has(`${sourceStart}:${sourceStart + length}`)
			? SpanMapKind.Atom
			: SpanMapKind.Verbatim;
		return {
			mapping: [generatedStart, length, sourceStart, length, kind, info.features],
			ignoreDiagnostics: !!info.ignoreDiagnostics,
		};
	}
}

/**
 * The diagnostic directives of the code, with the virtual ranges their bounding segments enclose; the source
 * offset of the segments is the original start, as it is relative to the file here. The generated code
 * whose diagnostics are ignored outside of them is covered by ignore directives without an original range.
 */
export function buildDiagnosticDirectives(chunks: Code[]) {
	const explicit = buildExplicitDiagnosticDirectives(chunks);
	const ignores = createIgnoreDirectives(getIgnoredRanges(chunks), explicit);
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

function buildExplicitDiagnosticDirectives(chunks: Code[]) {
	const directives: DiagnosticDirectiveMapping[] = [];
	const ranges: (DiagnosticDirectiveMapping | undefined)[] = [];
	let generatedStart = 0;
	for (const segment of chunks) {
		if (typeof segment === 'string') {
			generatedStart += segment.length;
			continue;
		}
		const data = segment[3];
		if (data && 'start' in data) {
			let range: DiagnosticDirectiveMapping | undefined;
			if (Array.isArray(data.start)) {
				const [, originalLength, , , policy] = data.start;
				range = [segment[2], originalLength, generatedStart, generatedStart, policy];
				directives.push(range);
			}
			ranges.push(range);
		}
		else if (data && 'end' in data) {
			const range = ranges.pop();
			if (range) {
				range[3] = generatedStart;
			}
		}
		generatedStart += segment[0].length;
	}
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
function toItems(chunks: Code[]) {
	const items: (Entry | Entry[])[] = [];
	/** The open ranges, `undefined` for diagnostic directives. */
	const ranges: (Entry[] | undefined)[] = [];
	const mappingRanges: Entry[][] = [];
	let generatedStart = 0;
	for (const segment of chunks) {
		if (typeof segment === 'string') {
			generatedStart += segment.length;
			continue;
		}
		const [text, , sourceStart, data] = segment;
		if (data === undefined) {
			const range = mappingRanges.at(-1);
			if (!range) {
				throw new Error(`Vue generated segment without data outside of a boundary at ${generatedStart}`);
			}
			range.push({ generatedStart, length: text.length, sourceStart, info: range[0]!.info });
		}
		else if ('start' in data) {
			if (Array.isArray(data.start)) {
				ranges.push(undefined);
			}
			else {
				const range = [{ generatedStart, length: 0, sourceStart, info: data.start }];
				ranges.push(range);
				mappingRanges.push(range);
				items.push(range);
			}
		}
		else if ('end' in data) {
			if (!ranges.length) {
				throw new Error(`Vue boundary end without a start at ${generatedStart}`);
			}
			const range = ranges.pop();
			if (range) {
				mappingRanges.pop();
				range.push({ generatedStart, length: 0, sourceStart, info: range[0]!.info });
			}
		}
		else {
			items.push({ generatedStart, length: text.length, sourceStart, info: data });
		}
		generatedStart += text.length;
	}
	if (ranges.length) {
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

/** A feature-less atom only carries diagnostics, so the segments it overlaps take precedence. */
function isFill(kind: SpanMapKind, features: number) {
	return kind !== SpanMapKind.Verbatim && !(features & allFeatures);
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
