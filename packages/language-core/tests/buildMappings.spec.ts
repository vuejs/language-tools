import { SpanMapKind } from '@volar/language-core';
import { expect, test } from 'vitest';
import { codeFeatures, ignoreDiagnostics, toAtomGroup, toAtomKind } from '../lib/codegen/codeFeatures';
import { type Code, type DiagnosticDirectiveMapping, DiagnosticDirectivePolicy } from '../lib/types';
import { buildDiagnosticDirectives, buildDiagnosticIgnores, buildMappings } from '../lib/utils/buildMappings';

const { navigation, navigationAndCompletion, none } = codeFeatures;

test('merges a boundary-wrapped token into one atom', () => {
	const data = toAtomGroup(navigation);
	expect(buildMappings([
		'-'.repeat(10),
		['', 'template', 20, data],
		`'`,
		['a-b', 'template', 20, data],
		`'`,
		['', 'template', 23, data],
	])).toEqual([
		[10, 5, 20, 3, SpanMapKind.Atom, navigation],
	]);
});

test('keeps the content of a boundary-wrapped completion token separate', () => {
	const data = toAtomGroup(navigationAndCompletion);
	expect(buildMappings([
		'-'.repeat(10),
		['', 'template', 20, data],
		`'`,
		['ab', 'template', 20, data],
		`'`,
		['', 'template', 22, data],
	])).toEqual([
		[10, 4, 20, 2, SpanMapKind.Atom, 0],
		[11, 2, 20, 2, SpanMapKind.Verbatim, navigationAndCompletion],
	]);
});

test('keeps an empty boundary-wrapped completion token as a point', () => {
	const data = toAtomGroup(navigationAndCompletion);
	expect(buildMappings([
		'-'.repeat(10),
		['', 'template', 20, data],
		`'`,
		['', 'template', 20, data],
		`'`,
		['', 'template', 20, data],
	])).toEqual([
		[10, 2, 20, 0, SpanMapKind.Atom, 0],
		[11, 0, 20, 0, SpanMapKind.Verbatim, navigationAndCompletion],
	]);
});

test('merges camelized segments into one atom', () => {
	const data = toAtomGroup(navigation);
	expect(buildMappings([
		['v', 'template', 0, data],
		['Once', 'template', 2, data],
	])).toEqual([
		[0, 5, 0, 6, SpanMapKind.Atom, navigation],
	]);
});

test('merges contiguous group members into one verbatim span', () => {
	const data = toAtomGroup(navigation);
	expect(buildMappings([
		['a', 'template', 0, data],
		['bc', 'template', 1, data],
	])).toEqual([
		[0, 3, 0, 3, SpanMapKind.Verbatim, navigation],
	]);
});

test('keeps a single-use group member as an individual span', () => {
	expect(buildMappings([
		['Click', 'template', 1, toAtomGroup(navigation)],
		['', 'template', 6, toAtomGroup(navigation)],
	])).toEqual([
		[0, 5, 1, 5, SpanMapKind.Verbatim, navigation],
	]);
});

test('maps every segment sharing a shorthand source range as an atom', () => {
	expect(buildMappings([
		'{',
		['a', 'template', 1, navigation],
		': ',
		['a', 'template', 1, toAtomKind(navigation)],
		'}',
	])).toEqual([
		[1, 1, 1, 1, SpanMapKind.Atom, navigation],
		[4, 1, 1, 1, SpanMapKind.Atom, navigation],
	]);
});

test('lets segments inside a feature-less group stay individual', () => {
	const boundary = toAtomGroup(none);
	expect(buildMappings([
		['', 'template', 0, boundary],
		'{a: ',
		['b', 'template', 2, navigation],
		'}',
		['', 'template', 1, boundary],
	])).toEqual([
		[0, 6, 0, 1, SpanMapKind.Atom, none],
		[4, 1, 2, 1, SpanMapKind.Verbatim, navigation],
	]);
});

test('keeps diagnostic directives out of the mappings', () => {
	const directive: DiagnosticDirectiveMapping = [5, 3, 0, 0, DiagnosticDirectivePolicy.Ignore];
	const chunks: Code[] = [
		['', 'template', 5, directive],
		['abc', 'template', 5, none],
		['', 'template', 5, directive],
	];
	expect(buildMappings(chunks)).toEqual([
		[0, 3, 5, 3, SpanMapKind.Verbatim, none],
	]);
	expect(buildDiagnosticDirectives(chunks)).toEqual([
		[5, 3, 0, 3, DiagnosticDirectivePolicy.Ignore],
	]);
});

test('takes the original start of a directive from the source offset of its segments', () => {
	const directive: DiagnosticDirectiveMapping = [5, 3, 0, 0, DiagnosticDirectivePolicy.Expect];
	expect(buildDiagnosticDirectives([
		'-'.repeat(10),
		['', undefined, 105, directive],
		'abc',
		['', undefined, 105, directive],
	])).toEqual([
		[105, 3, 10, 13, DiagnosticDirectivePolicy.Expect],
	]);
});

test('keeps an unclosed expectation empty and drops empty ignores', () => {
	const ignore: DiagnosticDirectiveMapping = [5, 3, 0, 0, DiagnosticDirectivePolicy.Ignore];
	const expectation: DiagnosticDirectiveMapping = [9, 3, 0, 0, DiagnosticDirectivePolicy.Expect];
	const empty: DiagnosticDirectiveMapping = [5, 3, 0, 0, DiagnosticDirectivePolicy.Ignore];
	expect(buildDiagnosticDirectives([
		['', 'template', 5, ignore],
		['', 'template', 9, expectation],
		'abc',
		['', 'template', 5, ignore],
		['', 'template', 5, empty],
		['', 'template', 5, empty],
	])).toEqual([
		[9, 3, 0, 0, DiagnosticDirectivePolicy.Expect],
		[5, 3, 0, 3, DiagnosticDirectivePolicy.Ignore],
	]);
});

test('covers each range a directive is reopened for', () => {
	const directive: DiagnosticDirectiveMapping = [5, 3, 0, 0, DiagnosticDirectivePolicy.Ignore];
	const reopened: DiagnosticDirectiveMapping = [...directive];
	expect(buildDiagnosticDirectives([
		['', 'template', 5, directive],
		'abc',
		['', 'template', 5, directive],
		'-',
		['', 'template', 5, reopened],
		'de',
		['', 'template', 5, reopened],
	])).toEqual([
		[5, 3, 0, 3, DiagnosticDirectivePolicy.Ignore],
		[5, 3, 4, 6, DiagnosticDirectivePolicy.Ignore],
	]);
});

test('ignores diagnostics of segments marked to ignore them', () => {
	expect(buildDiagnosticIgnores([
		['ab', 'template', 0, ignoreDiagnostics(navigation)],
		['cd', 'template', 2, navigation],
		['', 'template', 4, ignoreDiagnostics(none)],
	])).toEqual([[0, 2]]);
});

test('lets segments inside an ignored group report diagnostics', () => {
	const boundary = toAtomGroup(ignoreDiagnostics(none));
	expect(buildDiagnosticIgnores([
		['', 'template', 0, boundary],
		'{a: ',
		['b', 'template', 2, navigation],
		'}',
		['', 'template', 1, boundary],
	])).toEqual([[0, 4], [5, 6]]);
});

test('lets a reported group inside an ignored group report diagnostics', () => {
	// generated: {a: (b)}   original: C b
	const outer = toAtomGroup(ignoreDiagnostics(none));
	const inner = toAtomGroup(none);
	expect(buildDiagnosticIgnores([
		['', 'template', 0, outer],
		'{a: ',
		['', 'template', 2, inner],
		'(',
		['b', 'template', 2, navigation],
		')',
		['', 'template', 3, inner],
		'}',
		['', 'template', 1, outer],
	])).toEqual([[0, 4], [7, 8]]);
});

test('keeps ignoring a group whose source range crosses a taken one', () => {
	// generated: {a: "b"}   original: C a b   (`: "b"` maps to `a b`, which contains `b`)
	const outer = toAtomGroup(ignoreDiagnostics(none));
	const inner = toAtomGroup(none);
	expect(buildDiagnosticIgnores([
		['', 'template', 0, outer],
		'{a',
		['', 'template', 2, inner],
		': "',
		['b', 'template', 4, navigation],
		'"',
		['', 'template', 5, inner],
		'}',
		['', 'template', 1, outer],
	])).toEqual([[0, 5], [6, 8]]);
});
