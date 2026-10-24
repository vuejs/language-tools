import {
	allFeatures,
	completionFeatures,
	type Mapping,
	navigationFeatures,
	semanticFeatures,
	SpanMapKind as VolarSpanMapKind,
	VueCodeFeature,
} from '@vue/language-core';
import { expect, test } from 'vitest';
import { SpanMapFeature, SpanMapKind } from '../protocol';
import { toSpanMappings } from '../spanMappings';

const Verbatim = VolarSpanMapKind.Verbatim;
const Atom = VolarSpanMapKind.Atom;

test('passes language feature bits through and strips the bits outside the protocol', () => {
	const mappings: Mapping[] = [
		[0, 1, 0, 1, Verbatim, 0],
		[1, 2, 1, 2, Verbatim, allFeatures | VueCodeFeature.PropsCompletion],
	];

	expect(toSpanMappings(mappings, 'abc', 'abc')).toEqual([
		[0, 1, 0, 1, SpanMapKind.Verbatim, 0],
		[1, 2, 1, 2, SpanMapKind.Verbatim, allFeatures],
	]);
});

test('feature bits match the host protocol (spanmap.go)', () => {
	expect(SpanMapFeature.Hover).toBe(1 << 0);
	expect(SpanMapFeature.SignatureHelp).toBe(1 << 1);
	expect(SpanMapFeature.Completion).toBe(1 << 2);
	expect(SpanMapFeature.Definition).toBe(1 << 3);
	expect(SpanMapFeature.TypeDefinition).toBe(1 << 4);
	expect(SpanMapFeature.Implementation).toBe(1 << 5);
	expect(SpanMapFeature.References).toBe(1 << 6);
	expect(SpanMapFeature.DocumentHighlights).toBe(1 << 7);
	expect(SpanMapFeature.Rename).toBe(1 << 8);
	expect(SpanMapFeature.CallHierarchy).toBe(1 << 9);
	expect(SpanMapFeature.CodeActions).toBe(1 << 10);
	expect(SpanMapFeature.Formatting).toBe(1 << 11);
	expect(SpanMapFeature.InlayHints).toBe(1 << 12);
	expect(SpanMapFeature.SemanticTokens).toBe(1 << 13);
	expect(SpanMapFeature.FoldingRanges).toBe(1 << 14);
	expect(SpanMapFeature.SelectionRanges).toBe(1 << 15);
	expect(SpanMapFeature.LinkedEditing).toBe(1 << 16);
	expect(SpanMapFeature.AutoInsert).toBe(1 << 17);
	expect(SpanMapFeature.DocumentSymbols).toBe(1 << 18);
	expect(SpanMapFeature.CodeLens).toBe(1 << 19);
	expect(allFeatures).toBe((SpanMapFeature.CodeLens << 1) - 1);
});

test('can disable language feature mapping without losing diagnostic spans', () => {
	expect(toSpanMappings([[0, 3, 0, 3, Verbatim, navigationFeatures]], 'abc', 'abc', false))
		.toEqual([[0, 3, 0, 3, SpanMapKind.Verbatim, 0]]);
});

test('maps verbatim mappings whose texts differ as atoms', () => {
	expect(toSpanMappings([[0, 5, 0, 5, Verbatim, navigationFeatures]], 'Click', 'click'))
		.toEqual([[0, 5, 0, 5, SpanMapKind.Atom, navigationFeatures]]);
});

test('keeps exact duplicate projections and removes incompatible overlaps', () => {
	expect(toSpanMappings(
		[
			[0, 2, 0, 2, Verbatim, 0],
			[2, 2, 0, 2, Verbatim, 0],
			[4, 2, 1, 2, Verbatim, 0],
			[1, 2, 4, 2, Verbatim, 0],
		],
		'abcdefgh',
		'abefghij',
	)).toEqual([
		[0, 2, 0, 2, SpanMapKind.Verbatim, 0],
		[2, 2, 0, 2, SpanMapKind.Atom, 0],
	]);
});

test('keeps zero-length navigation anchors and drops other zero-length markers', () => {
	expect(toSpanMappings(
		[
			[0, 3, 0, 3, Verbatim, semanticFeatures],
			[3, 0, 0, 0, Verbatim, navigationFeatures | semanticFeatures],
			[3, 0, 1, 0, Verbatim, 0],
			[3, 0, 2, 0, Verbatim, VueCodeFeature.PropsCompletion],
		],
		'abc',
		'abc',
	)).toEqual([
		[0, 3, 0, 3, SpanMapKind.Verbatim, semanticFeatures],
		[3, 0, 0, 0, SpanMapKind.Verbatim, navigationFeatures],
	]);
});

test('keeps zero-length completion points', () => {
	expect(toSpanMappings([[2, 0, 1, 0, Verbatim, completionFeatures]], 'abc', 'abc'))
		.toEqual([[2, 0, 1, 0, SpanMapKind.Verbatim, completionFeatures]]);
});

test('lets segments inside a feature-less atom win and fills around them', () => {
	// generated: {a: b}   (atom 0..6 mapped to `C`, `b` at 4..5)
	// original:  C b
	expect(toSpanMappings(
		[
			[0, 6, 0, 1, Atom, 0],
			[4, 1, 2, 1, Verbatim, navigationFeatures],
		],
		'{a: b}',
		'C b',
	)).toEqual([
		[0, 4, 0, 1, SpanMapKind.Atom, 0],
		[4, 1, 2, 1, SpanMapKind.Verbatim, navigationFeatures],
		[5, 1, 0, 1, SpanMapKind.Atom, 0],
	]);
});

test('fills around segments inside an atom without language features', () => {
	expect(toSpanMappings(
		[
			[0, 6, 0, 1, Atom, 0],
			[4, 1, 2, 1, Verbatim, navigationFeatures],
		],
		'{a: b}',
		'C b',
		false,
	)).toEqual([
		[0, 4, 0, 1, SpanMapKind.Atom, 0],
		[4, 1, 2, 1, SpanMapKind.Verbatim, 0],
		[5, 1, 0, 1, SpanMapKind.Atom, 0],
	]);
});

test('keeps atoms with equal texts as atoms', () => {
	// generated: {a: a}   original: {a}
	expect(toSpanMappings(
		[
			[1, 1, 1, 1, Atom, navigationFeatures],
			[4, 1, 1, 1, Atom, navigationFeatures],
		],
		'{a: a}',
		'{a}',
	)).toEqual([
		[1, 1, 1, 1, SpanMapKind.Atom, navigationFeatures],
		[4, 1, 1, 1, SpanMapKind.Atom, navigationFeatures],
	]);
});

test('cuts a verbatim section at a navigation-only copy of its content', () => {
	// generated: f(x); x   (`x` copied from the section at 2..3 to 6..7)
	// original:  f(x);
	expect(toSpanMappings(
		[
			[0, 5, 0, 5, Verbatim, navigationFeatures],
			[6, 1, 2, 1, Verbatim, navigationFeatures],
		],
		'f(x); x',
		'f(x);',
	)).toEqual([
		[0, 2, 0, 2, SpanMapKind.Verbatim, navigationFeatures],
		[2, 1, 2, 1, SpanMapKind.Verbatim, navigationFeatures],
		[3, 2, 3, 2, SpanMapKind.Verbatim, navigationFeatures],
		[6, 1, 2, 1, SpanMapKind.Verbatim, navigationFeatures],
	]);
});

test('cuts a verbatim section at a copy that also offers completion', () => {
	// generated: ('a'); a   (`a` copied from the section at 2..3 to 7..8)
	// original:  ('a');
	expect(toSpanMappings(
		[
			[0, 5, 0, 5, Verbatim, 0],
			[7, 1, 2, 1, Verbatim, navigationFeatures | completionFeatures],
		],
		`('a'); a`,
		`('a');`,
	)).toEqual([
		[0, 2, 0, 2, SpanMapKind.Verbatim, 0],
		[2, 1, 2, 1, SpanMapKind.Verbatim, 0],
		[3, 2, 3, 2, SpanMapKind.Verbatim, 0],
		[7, 1, 2, 1, SpanMapKind.Verbatim, navigationFeatures | completionFeatures],
	]);
});
