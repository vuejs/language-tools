import { SpanMapKind } from '@volar/language-core';
import { expect, test } from 'vitest';
import { codeFeatures, ignoreDiagnostics, toAtomKind } from '../lib/codegen/codeFeatures';
import {
	type Code,
	type CodeBoundary,
	type DiagnosticDirectiveMapping,
	DiagnosticDirectivePolicy,
	type VueCodeMarker,
} from '../lib/types';
import { buildDiagnosticDirectives, buildMappings } from '../lib/utils/buildMappings';

const { navigation, navigationAndCompletion, none } = codeFeatures;
const end: CodeBoundary = { end: true };

test('merges a boundary-wrapped token into one atom', () => {
	expect(buildMappings([
		'-'.repeat(10),
		['', 'template', 20, start(navigation)],
		`'`,
		['a-b', 'template', 20, undefined],
		`'`,
		['', 'template', 23, end],
	])).toEqual([
		[10, 5, 20, 3, SpanMapKind.Atom, navigation.features],
	]);
});

test('keeps the content of a boundary-wrapped completion token separate', () => {
	expect(buildMappings([
		'-'.repeat(10),
		['', 'template', 20, start(navigationAndCompletion)],
		`'`,
		['ab', 'template', 20, undefined],
		`'`,
		['', 'template', 22, end],
	])).toEqual([
		[10, 4, 20, 2, SpanMapKind.Atom, 0],
		[11, 2, 20, 2, SpanMapKind.Verbatim, navigationAndCompletion.features],
	]);
});

test('keeps an empty boundary-wrapped completion token as a point', () => {
	expect(buildMappings([
		'-'.repeat(10),
		['', 'template', 20, start(navigationAndCompletion)],
		`'`,
		['', 'template', 20, undefined],
		`'`,
		['', 'template', 20, end],
	])).toEqual([
		[10, 2, 20, 0, SpanMapKind.Atom, 0],
		[11, 0, 20, 0, SpanMapKind.Verbatim, navigationAndCompletion.features],
	]);
});

test('merges camelized segments into one atom', () => {
	expect(buildMappings([
		['', 'template', 0, start(navigation)],
		['v', 'template', 0, undefined],
		['Once', 'template', 2, undefined],
		['', 'template', 6, end],
	])).toEqual([
		[0, 5, 0, 6, SpanMapKind.Atom, navigation.features],
	]);
});

test('merges a verbatim copy into one verbatim span', () => {
	expect(buildMappings([
		['', 'template', 0, start(navigation)],
		['a', 'template', 0, undefined],
		['bc', 'template', 1, undefined],
		['', 'template', 3, end],
	])).toEqual([
		[0, 3, 0, 3, SpanMapKind.Verbatim, navigation.features],
	]);
});

test('pairs boundaries by nesting and maps a segment without data as part of the innermost one', () => {
	// generated: (a.b)   original: a-b
	expect(buildMappings([
		['', 'template', 0, start(none)],
		'(',
		['', 'template', 0, start(navigation)],
		['a', 'template', 0, undefined],
		'.',
		['b', 'template', 2, undefined],
		['', 'template', 3, end],
		')',
		['', 'template', 3, end],
	])).toEqual([
		[0, 5, 0, 3, SpanMapKind.Atom, none.features],
		[1, 3, 0, 3, SpanMapKind.Atom, navigation.features],
	]);
});

test('rejects unbalanced boundaries and segments without data outside of them', () => {
	expect(() => buildMappings([['', 'template', 0, start(none)]])).toThrow();
	expect(() => buildMappings([['', 'template', 0, end]])).toThrow();
	expect(() => buildMappings([['a', 'template', 0, undefined]])).toThrow();
});

test('maps every segment sharing a shorthand source range as an atom', () => {
	expect(buildMappings([
		'{',
		['a', 'template', 1, navigation],
		': ',
		['a', 'template', 1, toAtomKind(navigation)],
		'}',
	])).toEqual([
		[1, 1, 1, 1, SpanMapKind.Atom, navigation.features],
		[4, 1, 1, 1, SpanMapKind.Atom, navigation.features],
	]);
});

test('lets segments inside a feature-less boundary stay individual', () => {
	expect(buildMappings([
		['', 'template', 0, start(none)],
		'{a: ',
		['b', 'template', 2, navigation],
		'}',
		['', 'template', 1, end],
	])).toEqual([
		[0, 6, 0, 1, SpanMapKind.Atom, none.features],
		[4, 1, 2, 1, SpanMapKind.Verbatim, navigation.features],
	]);
});

test('keeps diagnostic directives out of the mappings', () => {
	const directive: DiagnosticDirectiveMapping = [5, 3, 0, 0, DiagnosticDirectivePolicy.Ignore];
	const chunks: Code[] = [
		['', 'template', 5, start(directive)],
		['abc', 'template', 5, none],
		['', 'template', 5, end],
	];
	expect(buildMappings(chunks)).toEqual([
		[0, 3, 5, 3, SpanMapKind.Verbatim, none.features],
	]);
	expect(buildDiagnosticDirectives(chunks)).toEqual([
		[5, 3, 0, 3, DiagnosticDirectivePolicy.Ignore],
	]);
});

test('takes the original start of a directive from the source offset of its start', () => {
	const directive: DiagnosticDirectiveMapping = [5, 3, 0, 0, DiagnosticDirectivePolicy.Expect];
	expect(buildDiagnosticDirectives([
		'-'.repeat(10),
		['', undefined, 105, start(directive)],
		'abc',
		['', undefined, 105, end],
	])).toEqual([
		[105, 3, 10, 13, DiagnosticDirectivePolicy.Expect],
	]);
});

test('keeps an empty expectation and drops empty ignores', () => {
	const ignore: DiagnosticDirectiveMapping = [5, 3, 0, 0, DiagnosticDirectivePolicy.Ignore];
	const expectation: DiagnosticDirectiveMapping = [9, 3, 0, 0, DiagnosticDirectivePolicy.Expect];
	expect(buildDiagnosticDirectives([
		['', 'template', 5, start(ignore)],
		['', 'template', 9, start(expectation)],
		['', 'template', 9, end],
		'abc',
		['', 'template', 5, end],
		['', 'template', 5, start(ignore)],
		['', 'template', 5, end],
	])).toEqual([
		[9, 3, 0, 0, DiagnosticDirectivePolicy.Expect],
		[5, 3, 0, 3, DiagnosticDirectivePolicy.Ignore],
	]);
});

test('pairs directive and mapping boundaries by nesting', () => {
	const directive: DiagnosticDirectiveMapping = [5, 3, 0, 0, DiagnosticDirectivePolicy.Ignore];
	const chunks: Code[] = [
		['', 'template', 5, start(directive)],
		['', 'template', 0, start(navigation)],
		['a', 'template', 0, undefined],
		'.',
		['', 'template', 2, end],
		['b', 'template', 2, none],
		['', 'template', 5, end],
		'-',
		['', 'template', 5, start(directive)],
		'de',
		['', 'template', 5, end],
	];
	expect(buildMappings(chunks)).toEqual([
		[0, 2, 0, 2, SpanMapKind.Atom, navigation.features],
		[2, 1, 2, 1, SpanMapKind.Verbatim, none.features],
	]);
	expect(buildDiagnosticDirectives(chunks)).toEqual([
		[5, 3, 0, 3, DiagnosticDirectivePolicy.Ignore],
		[5, 3, 4, 6, DiagnosticDirectivePolicy.Ignore],
	]);
});

test('ignores diagnostics of segments marked to ignore them', () => {
	expect(buildDiagnosticDirectives([
		['ab', 'template', 0, ignoreDiagnostics(navigation)],
		['cd', 'template', 2, navigation],
		['', 'template', 4, ignoreDiagnostics(none)],
	])).toEqual(toIgnores([0, 2]));
});

test('lets segments inside an ignored boundary report diagnostics', () => {
	expect(buildDiagnosticDirectives([
		['', 'template', 0, start(ignoreDiagnostics(none))],
		'{a: ',
		['b', 'template', 2, navigation],
		'}',
		['', 'template', 1, end],
	])).toEqual(toIgnores([0, 4], [5, 6]));
});

test('lets a reported boundary inside an ignored boundary report diagnostics', () => {
	// generated: {a: (b)}   original: C b
	expect(buildDiagnosticDirectives([
		['', 'template', 0, start(ignoreDiagnostics(none))],
		'{a: ',
		['', 'template', 2, start(none)],
		'(',
		['b', 'template', 2, navigation],
		')',
		['', 'template', 3, end],
		'}',
		['', 'template', 1, end],
	])).toEqual(toIgnores([0, 4], [7, 8]));
});

test('keeps ignoring a boundary whose source range crosses a taken one', () => {
	// generated: {a: "b"}   original: C a b   (`: "b"` maps to `a b`, which contains `b`)
	expect(buildDiagnosticDirectives([
		['', 'template', 0, start(ignoreDiagnostics(none))],
		'{a',
		['', 'template', 2, start(none)],
		': "',
		['b', 'template', 4, navigation],
		'"',
		['', 'template', 5, end],
		'}',
		['', 'template', 1, end],
	])).toEqual(toIgnores([0, 5], [6, 8]));
});

test('leaves the ranges of explicit directives to them', () => {
	const expectation: DiagnosticDirectiveMapping = [7, 2, 0, 0, DiagnosticDirectivePolicy.Expect];
	expect(buildDiagnosticDirectives([
		['ab', 'template', 0, ignoreDiagnostics(navigation)],
		['', 'template', 7, start(expectation)],
		['cd', 'template', 2, ignoreDiagnostics(navigation)],
		['', 'template', 7, end],
		['ef', 'template', 4, ignoreDiagnostics(navigation)],
	])).toEqual([
		[0, 0, 0, 2, DiagnosticDirectivePolicy.Ignore],
		[7, 2, 2, 4, DiagnosticDirectivePolicy.Expect],
		[0, 0, 4, 6, DiagnosticDirectivePolicy.Ignore],
	]);
});

function toIgnores(...ranges: [start: number, end: number][]): DiagnosticDirectiveMapping[] {
	return ranges.map(([start, end]) => [0, 0, start, end, DiagnosticDirectivePolicy.Ignore]);
}

function start(data: VueCodeMarker | DiagnosticDirectiveMapping): CodeBoundary {
	return { start: data };
}
