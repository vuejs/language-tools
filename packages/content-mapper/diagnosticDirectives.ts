import { type DiagnosticDirectiveMapping, DiagnosticDirectivePolicy, type SpanMapping } from './protocol';

export function withSynthesizedDiagnosticIgnores(
	virtualLength: number,
	mappings: readonly SpanMapping[],
	directives: readonly DiagnosticDirectiveMapping[],
) {
	const result = [...directives];
	const blocked = [...directives].sort(
		(left, right) => left[2] - right[2],
	);
	let virtualStart = 0;
	let blockedIndex = 0;

	for (const [start, length] of mappings) {
		if (length) {
			addIgnoreRanges(virtualStart, start);
			virtualStart = start + length;
		}
	}
	addIgnoreRanges(virtualStart, virtualLength);

	result.sort((left, right) => left[2] - right[2] || left[3] - right[3]);
	return mergeSynthesizedIgnores(result);

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

function mergeSynthesizedIgnores(directives: DiagnosticDirectiveMapping[]) {
	const result: DiagnosticDirectiveMapping[] = [];
	for (const directive of directives) {
		const previous = result.at(-1);
		if (previous && isSynthesizedIgnore(previous) && isSynthesizedIgnore(directive) && previous[3] === directive[2]) {
			result[result.length - 1] = [0, 0, previous[2], directive[3], DiagnosticDirectivePolicy.Ignore];
		}
		else {
			result.push(directive);
		}
	}
	return result;
}

function isSynthesizedIgnore(directive: DiagnosticDirectiveMapping) {
	return directive[4] === DiagnosticDirectivePolicy.Ignore && !directive[0] && !directive[1];
}
