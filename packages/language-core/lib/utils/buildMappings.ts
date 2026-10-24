import { type Mapping, SpanMapFeature, SpanMapKind } from '@volar/language-core';
import { type Code, type DiagnosticDirectiveMapping, DiagnosticDirectivePolicy, type VueCodeMarker } from '../types';

const languageFeatureMask = (SpanMapFeature.CodeLens << 1) - 1;

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
	const entries = toEntries(chunks);
	const tokenCounts = new Map<symbol, number>();
	const shorthandRanges = new Set<string>();
	for (const { info, sourceStart, length } of entries) {
		if (info.atom) {
			tokenCounts.set(info.atom, (tokenCounts.get(info.atom) ?? 0) + 1);
		}
		if (info.kind === SpanMapKind.Atom) {
			shorthandRanges.add(`${sourceStart}:${sourceStart + length}`);
		}
	}

	const spans: (Span | Entry[])[] = [];
	const groups = new Map<symbol, Entry[]>();
	for (const entry of entries) {
		const { atom } = entry.info;
		if (atom && tokenCounts.get(atom)! > 1) {
			let group = groups.get(atom);
			if (!group) {
				groups.set(atom, group = []);
				spans.push(group);
			}
			group.push(entry);
		}
		else if (!atom || entry.length) {
			spans.push(toSpan(entry));
		}
	}

	return spans.flatMap(span => isGroup(span) ? fromGroup(span) : [span]);

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
			&& content.info.features & SpanMapFeature.Completion
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
	const ignores = subtractRanges(
		getIgnoredRanges(chunks),
		explicit.map(directive => [directive[2], directive[3]]),
	).map<DiagnosticDirectiveMapping>(([start, end]) => [0, 0, start, end, DiagnosticDirectivePolicy.Ignore]);
	return [...explicit, ...ignores].sort((left, right) => left[2] - right[2] || left[3] - right[3]);
}

function buildExplicitDiagnosticDirectives(chunks: Code[]) {
	const directives: DiagnosticDirectiveMapping[] = [];
	const opened = new Map<DiagnosticDirectiveMapping, DiagnosticDirectiveMapping>();
	let generatedStart = 0;
	for (const segment of chunks) {
		if (typeof segment === 'string') {
			generatedStart += segment.length;
			continue;
		}
		const data = segment[3];
		if (Array.isArray(data)) {
			const range = opened.get(data);
			if (range) {
				range[3] = generatedStart;
				opened.delete(data);
			}
			else {
				const [, originalLength, , , policy] = data;
				const range: DiagnosticDirectiveMapping = [segment[2], originalLength, generatedStart, generatedStart, policy];
				opened.set(data, range);
				directives.push(range);
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

function toEntries(chunks: Code[]) {
	const entries: Entry[] = [];
	let generatedStart = 0;
	for (const segment of chunks) {
		if (typeof segment === 'string') {
			generatedStart += segment.length;
		}
		else {
			const data = segment[3];
			if (!Array.isArray(data)) {
				entries.push({
					generatedStart,
					length: segment[0].length,
					sourceStart: segment[2],
					info: data,
				});
			}
			generatedStart += segment[0].length;
		}
	}
	return entries;
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

function isGroup(span: Span | Entry[]): span is Entry[] {
	return Array.isArray(span);
}

/** A feature-less atom only carries diagnostics, so the segments it overlaps take precedence. */
function isFill(kind: SpanMapKind, features: number) {
	return kind !== SpanMapKind.Verbatim && !(features & languageFeatureMask);
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
