import { SpanMapFeature, SpanMapKind } from '@volar/language-core';
import { expect, test } from 'vitest';
import { codeFeatures, toAtomGroup, toAtomKind } from '../lib/codegen/codeFeatures';
import type { Code } from '../lib/types';
import { buildDiagnosticDirectiveMarkers, buildMappings } from '../lib/utils/buildMappings';

const { navigation, navigationAndCompletion, verification } = codeFeatures;

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
	const boundary = toAtomGroup(verification);
	expect(buildMappings([
		['', 'template', 0, boundary],
		'{a: ',
		['b', 'template', 2, navigation],
		'}',
		['', 'template', 1, boundary],
	])).toEqual([
		[0, 6, 0, 1, SpanMapKind.Atom, verification],
		[4, 1, 2, 1, SpanMapKind.Verbatim, navigation],
	]);
});

test('collects diagnostic directive markers outside the mappings', () => {
	const directive = { policy: 'ignore' as const, originalLength: 3 };
	const chunks: Code[] = [
		['', 'template', 5, { features: 0, diagnosticDirective: { directive, phase: 'anchor' } }],
		['abc', 'template', 5, { features: verification, diagnosticDirective: { directive, phase: 'content' } }],
	];
	expect(buildMappings(chunks)).toEqual([
		[0, 0, 5, 0, SpanMapKind.Verbatim, 0],
		[0, 3, 5, 3, SpanMapKind.Verbatim, SpanMapFeature.Verification],
	]);
	expect(buildDiagnosticDirectiveMarkers(chunks)).toEqual([
		{ directive, phase: 'anchor', generatedStart: 0, generatedLength: 0, sourceStart: 5 },
		{ directive, phase: 'content', generatedStart: 0, generatedLength: 3, sourceStart: 5 },
	]);
});
