import { type DiagnosticDirectiveMapping, DiagnosticDirectivePolicy, type SpanMapping } from './protocol';

export function withSynthesizedDiagnosticIgnores(
	virtualLength: number,
	mappings: readonly SpanMapping[],
	directives: readonly DiagnosticDirectiveMapping[],
	/** Sorted, disjoint virtual ranges whose diagnostics are not reported. */
	ignoredRanges: readonly [start: number, end: number][] = [],
) {
	const result = [...directives];
	const blocked = [...directives].sort(
		(left, right) => left[2] - right[2],
	);
	let virtualStart = 0;
	let blockedIndex = 0;
	let ignoredIndex = 0;

	for (const [start, length] of mappings) {
		if (length) {
			addReportedRange(start, start + length);
		}
	}
	addIgnoreRanges(virtualStart, virtualLength);

	result.sort((left, right) => left[2] - right[2] || left[3] - right[3]);
	return result;

	function addReportedRange(start: number, end: number) {
		while (ignoredIndex < ignoredRanges.length && ignoredRanges[ignoredIndex]![1] <= start) {
			ignoredIndex++;
		}
		for (let index = ignoredIndex; index < ignoredRanges.length; index++) {
			const [ignoredStart, ignoredEnd] = ignoredRanges[index]!;
			if (ignoredStart >= end) {
				break;
			}
			if (start < ignoredStart) {
				addIgnoreRanges(virtualStart, start);
				virtualStart = ignoredStart;
			}
			start = Math.max(start, ignoredEnd);
		}
		if (start < end) {
			addIgnoreRanges(virtualStart, start);
			virtualStart = end;
		}
	}

	function addIgnoreRanges(start: number, end: number) {
		if (start >= end) {
			return;
		}
		while (
			blockedIndex < blocked.length
			&& blocked[blockedIndex]![3] <= start
		) {
			blockedIndex++;
		}
		let cursor = start;
		for (let index = blockedIndex; index < blocked.length; index++) {
			const directive = blocked[index]!;
			if (directive[2] >= end) {
				break;
			}
			addIgnore(cursor, Math.min(directive[2], end));
			cursor = Math.max(
				cursor,
				directive[3],
			);
			if (cursor >= end) {
				return;
			}
		}
		addIgnore(cursor, end);
	}

	function addIgnore(start: number, end: number) {
		if (start < end) {
			result.push([0, 0, start, end, DiagnosticDirectivePolicy.Ignore]);
		}
	}
}
