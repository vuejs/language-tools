import { SpanMapKind, type SpanMapSegment } from '@volar/language-core';
import { completionFeatures, type IRBlock, navigationFeatures, type VueCodeMarker } from '@vue/language-core';
import { expect, test } from 'vitest';
import { type CodeBoundary, mapped, synthesizedIgnore, type TsCode } from '../lib/codegen/tsCode';
import { type DiagnosticDirectiveMapping, DiagnosticDirectivePolicy } from '../lib/protocol';
import { buildDiagnosticDirectives, buildMappings } from '../lib/result/tsCodeMappings';

const navigation = { features: navigationFeatures };
const navigationAndCompletion = { features: navigationFeatures | completionFeatures };
const none = { features: 0 };
const end: CodeBoundary = { end: true };
const template = { name: 'template', offset: 0 } as IRBlock;

function seg(
	virtualStart: number,
	virtualLength: number,
	originalStart: number,
	originalLength: number,
	kind: SpanMapKind,
	features: number,
): SpanMapSegment {
	return {
		virtualStart,
		virtualEnd: virtualStart + virtualLength,
		originalStart,
		originalEnd: originalStart + originalLength,
		kind,
		features,
	};
}

test('merges a boundary-wrapped token into one atom', () => {
	expect(buildMappings([
		'-'.repeat(10),
		mapped('', template, 20, start(navigation)),
		`'`,
		mapped('a-b', template, 20, undefined),
		`'`,
		mapped('', template, 23, end),
	])).toEqual([
		seg(10, 5, 20, 3, SpanMapKind.Atom, navigation.features),
	]);
});

test('keeps the content of a boundary-wrapped completion token separate', () => {
	expect(buildMappings([
		'-'.repeat(10),
		mapped('', template, 20, start(navigationAndCompletion)),
		`'`,
		mapped('ab', template, 20, undefined),
		`'`,
		mapped('', template, 22, end),
	])).toEqual([
		seg(10, 4, 20, 2, SpanMapKind.Atom, 0),
		seg(11, 2, 20, 2, SpanMapKind.Verbatim, navigationAndCompletion.features),
	]);
});

test('keeps an empty boundary-wrapped completion token as a point', () => {
	expect(buildMappings([
		'-'.repeat(10),
		mapped('', template, 20, start(navigationAndCompletion)),
		`'`,
		mapped('', template, 20, undefined),
		`'`,
		mapped('', template, 20, end),
	])).toEqual([
		seg(10, 2, 20, 0, SpanMapKind.Atom, 0),
		seg(11, 0, 20, 0, SpanMapKind.Verbatim, navigationAndCompletion.features),
	]);
});

test('merges camelized pieces into one atom', () => {
	expect(buildMappings([
		mapped('', template, 0, start(navigation)),
		mapped('v', template, 0, undefined),
		mapped('Once', template, 2, undefined),
		mapped('', template, 6, end),
	])).toEqual([
		seg(0, 5, 0, 6, SpanMapKind.Atom, navigation.features),
	]);
});

test('merges a verbatim copy into one verbatim span', () => {
	expect(buildMappings([
		mapped('', template, 0, start(navigation)),
		mapped('a', template, 0, undefined),
		mapped('bc', template, 1, undefined),
		mapped('', template, 3, end),
	])).toEqual([
		seg(0, 3, 0, 3, SpanMapKind.Verbatim, navigation.features),
	]);
});

test('pairs boundaries by nesting and maps a piece without data as part of the innermost one', () => {
	// generated: (a.b)   original: a-b
	expect(buildMappings([
		mapped('', template, 0, start(none)),
		'(',
		mapped('', template, 0, start(navigation)),
		mapped('a', template, 0, undefined),
		'.',
		mapped('b', template, 2, undefined),
		mapped('', template, 3, end),
		')',
		mapped('', template, 3, end),
	])).toEqual([
		seg(0, 5, 0, 3, SpanMapKind.Atom, none.features),
		seg(1, 3, 0, 3, SpanMapKind.Atom, navigation.features),
	]);
});

test('rejects unbalanced boundaries and pieces without data outside of them', () => {
	expect(() => buildMappings([mapped('', template, 0, start(none))])).toThrow();
	expect(() => buildMappings([mapped('', template, 0, end)])).toThrow();
	expect(() => buildMappings([mapped('a', template, 0, undefined)])).toThrow();
});

test('maps a piece by the kind written in its data, verbatim if omitted', () => {
	expect(buildMappings([
		'{',
		mapped('a', template, 1, navigation),
		': ',
		mapped('a', template, 1, { ...navigation, kind: SpanMapKind.Atom }),
		'}',
	])).toEqual([
		seg(1, 1, 1, 1, SpanMapKind.Verbatim, navigation.features),
		seg(4, 1, 1, 1, SpanMapKind.Atom, navigation.features),
	]);
});

test('lets pieces inside a feature-less boundary stay individual', () => {
	expect(buildMappings([
		mapped('', template, 0, start(none)),
		'{a: ',
		mapped('b', template, 2, navigation),
		'}',
		mapped('', template, 1, end),
	])).toEqual([
		seg(0, 6, 0, 1, SpanMapKind.Atom, none.features),
		seg(4, 1, 2, 1, SpanMapKind.Verbatim, navigation.features),
	]);
});

test('keeps diagnostic directives out of the mappings', () => {
	const directive: DiagnosticDirectiveMapping = [5, 3, 0, 0, DiagnosticDirectivePolicy.Ignore];
	const chunks: TsCode[] = [
		mapped('', template, 5, start(directive)),
		mapped('abc', template, 5, none),
		mapped('', template, 5, end),
	];
	expect(buildMappings(chunks)).toEqual([
		seg(0, 3, 5, 3, SpanMapKind.Verbatim, none.features),
	]);
	expect(buildDiagnosticDirectives(chunks)).toEqual([
		[5, 3, 0, 3, DiagnosticDirectivePolicy.Ignore],
	]);
});

test('takes the original start of a directive from the source offset of its start', () => {
	const directive: DiagnosticDirectiveMapping = [5, 3, 0, 0, DiagnosticDirectivePolicy.Expect];
	expect(buildDiagnosticDirectives([
		'-'.repeat(10),
		mapped('', undefined, 105, start(directive)),
		'abc',
		mapped('', undefined, 105, end),
	])).toEqual([
		[105, 3, 10, 13, DiagnosticDirectivePolicy.Expect],
	]);
});

test('keeps an empty expectation and drops empty ignores', () => {
	const ignore: DiagnosticDirectiveMapping = [5, 3, 0, 0, DiagnosticDirectivePolicy.Ignore];
	const expectation: DiagnosticDirectiveMapping = [9, 3, 0, 0, DiagnosticDirectivePolicy.Expect];
	expect(buildDiagnosticDirectives([
		mapped('', template, 5, start(ignore)),
		mapped('', template, 9, start(expectation)),
		mapped('', template, 9, end),
		'abc',
		mapped('', template, 5, end),
		mapped('', template, 5, start(ignore)),
		mapped('', template, 5, end),
	])).toEqual([
		[9, 3, 0, 0, DiagnosticDirectivePolicy.Expect],
		[5, 3, 0, 3, DiagnosticDirectivePolicy.Ignore],
	]);
});

test('pairs directive and mapping boundaries by nesting', () => {
	const directive: DiagnosticDirectiveMapping = [5, 3, 0, 0, DiagnosticDirectivePolicy.Ignore];
	const chunks: TsCode[] = [
		mapped('', template, 5, start(directive)),
		mapped('', template, 0, start(navigation)),
		mapped('a', template, 0, undefined),
		'.',
		mapped('', template, 2, end),
		mapped('b', template, 2, none),
		mapped('', template, 5, end),
		'-',
		mapped('', template, 5, start(directive)),
		'de',
		mapped('', template, 5, end),
	];
	expect(buildMappings(chunks)).toEqual([
		seg(0, 2, 0, 2, SpanMapKind.Atom, navigation.features),
		seg(2, 1, 2, 1, SpanMapKind.Verbatim, none.features),
	]);
	expect(buildDiagnosticDirectives(chunks)).toEqual([
		[5, 3, 0, 3, DiagnosticDirectivePolicy.Ignore],
		[5, 3, 4, 6, DiagnosticDirectivePolicy.Ignore],
	]);
});

test('ignores diagnostics in the ranges of ignore directives without an original range', () => {
	expect(buildDiagnosticDirectives([
		mapped('', template, 0, start(synthesizedIgnore)),
		mapped('ab', template, 0, navigation),
		mapped('', template, 0, end),
		mapped('cd', template, 2, navigation),
		mapped('', template, 0, start(synthesizedIgnore)),
		mapped('', template, 4, none),
		mapped('', template, 0, end),
	])).toEqual(toIgnores([0, 2]));
});

test('merges ignore directives without an original range and leaves explicit directives their ranges', () => {
	const expectation: DiagnosticDirectiveMapping = [7, 2, 0, 0, DiagnosticDirectivePolicy.Expect];
	expect(buildDiagnosticDirectives([
		mapped('', template, 0, start(synthesizedIgnore)),
		'ab',
		mapped('', template, 0, start(synthesizedIgnore)),
		'cd',
		mapped('', template, 7, start(expectation)),
		'ef',
		mapped('', template, 7, end),
		mapped('', template, 0, end),
		mapped('', template, 0, end),
	])).toEqual([
		[0, 0, 0, 4, DiagnosticDirectivePolicy.Ignore],
		[7, 2, 4, 6, DiagnosticDirectivePolicy.Expect],
	]);
});

test('leaves the ranges of explicit directives to them', () => {
	const expectation: DiagnosticDirectiveMapping = [7, 2, 0, 0, DiagnosticDirectivePolicy.Expect];
	expect(buildDiagnosticDirectives([
		mapped('', template, 0, start(synthesizedIgnore)),
		mapped('ab', template, 0, navigation),
		mapped('', template, 7, start(expectation)),
		mapped('cd', template, 2, navigation),
		mapped('', template, 7, end),
		mapped('ef', template, 4, navigation),
		mapped('', template, 0, end),
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
