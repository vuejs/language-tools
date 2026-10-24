import type { DiagnosticDirectiveMarker } from '@vue/language-core';
import { type DiagnosticDirectiveMapping, DiagnosticDirectivePolicy, type SpanMapping } from './protocol';

interface DirectiveState {
	directive: DiagnosticDirectiveMarker['directive'];
	originalStart: number;
	contentRanges: [start: number, end: number][];
	anchor?: number;
	end?: number;
}

export function toDiagnosticDirectives(
	markers: readonly DiagnosticDirectiveMarker[],
): DiagnosticDirectiveMapping[] {
	const states = new Map<DirectiveState['directive'], DirectiveState>();

	for (const { directive, phase, generatedStart, generatedLength, sourceStart } of markers) {
		let state = states.get(directive);
		if (!state) {
			state = {
				directive,
				originalStart: sourceStart,
				contentRanges: [],
			};
			states.set(directive, state);
		}
		if (phase === 'anchor') {
			state.anchor = generatedStart;
			state.originalStart = sourceStart;
		}
		else if (phase === 'content') {
			if (generatedLength > 0) {
				state.contentRanges.push([generatedStart, generatedStart + generatedLength]);
			}
		}
		else {
			state.end = generatedStart;
		}
	}

	const result: DiagnosticDirectiveMapping[] = [];
	for (const state of states.values()) {
		if (state.anchor === undefined) {
			throw new Error('Vue diagnostic directive is missing an original anchor');
		}
		const contentRanges = mergeRanges(state.contentRanges);
		if (state.directive.policy === 'expect') {
			const last = contentRanges.at(-1);
			const virtualStart = state.anchor;
			const virtualEnd = state.end ?? last?.[1] ?? virtualStart;
			result.push([
				state.originalStart,
				state.directive.originalLength,
				virtualStart,
				virtualEnd,
				DiagnosticDirectivePolicy.Expect,
			]);
		}
		else {
			for (const [virtualStart, virtualEnd] of contentRanges) {
				result.push([
					state.originalStart,
					state.directive.originalLength,
					virtualStart,
					virtualEnd,
					DiagnosticDirectivePolicy.Ignore,
				]);
			}
		}
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

	result.sort((left, right) => left[2] - right[2]);
	for (let index = 1; index < result.length; index++) {
		const previous = result[index - 1]!;
		const current = result[index]!;
		if (current[2] < previous[3]) {
			throw new Error(
				`Vue diagnostic directive virtual ranges overlap: `
					+ `${previous[2]}:${previous[3]} and `
					+ `${current[2]}:${current[3]}`,
			);
		}
	}
	return result;
}

export function withSynthesizedDiagnosticIgnores(
	virtualLength: number,
	mappings: readonly SpanMapping[],
	directives: readonly DiagnosticDirectiveMapping[],
	unverifiedRanges: readonly [start: number, end: number][] = [],
) {
	const unverified = new Set(unverifiedRanges.map(([start, end]) => `${start}:${end}`));
	const result = [...directives];
	const blocked = [...directives].sort(
		(left, right) => left[2] - right[2],
	);
	let virtualStart = 0;
	let blockedIndex = 0;

	for (const mapping of mappings) {
		if (unverified.has(`${mapping[0]}:${mapping[0] + mapping[1]}`)) {
			continue;
		}
		addIgnoreRanges(virtualStart, mapping[0]);
		virtualStart = mapping[0] + mapping[1];
	}
	addIgnoreRanges(virtualStart, virtualLength);

	result.sort((left, right) => left[2] - right[2]);
	return result;

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
