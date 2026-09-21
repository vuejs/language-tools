import { expect, test } from 'vitest';
import { SpanMapFeature, SpanMapKind } from '../protocol';
import { toSpanMappings } from '../spanMappings';

test('preserves Vue mapping feature intent', () => {
	const mappings = toSpanMappings(
		[
			{
				sourceOffsets: [0, 1],
				generatedOffsets: [0, 1],
				lengths: [1, 1],
				data: { verification: true },
			},
			{
				sourceOffsets: [2],
				generatedOffsets: [2],
				lengths: [1],
				data: { semantic: true, navigation: true },
			},
		],
		'abc',
		'abc',
	);

	expect(mappings).toEqual([
		[0, 1, 0, 1, SpanMapKind.Verbatim, 0],
		[1, 1, 1, 1, SpanMapKind.Verbatim, 0],
		[
			2,
			1,
			2,
			1,
			SpanMapKind.Verbatim,
			SpanMapFeature.Hover
			| SpanMapFeature.SignatureHelp
			| SpanMapFeature.Definition
			| SpanMapFeature.TypeDefinition
			| SpanMapFeature.Implementation
			| SpanMapFeature.References
			| SpanMapFeature.DocumentHighlights
			| SpanMapFeature.Rename
			| SpanMapFeature.CallHierarchy
			| SpanMapFeature.CodeActions
			| SpanMapFeature.InlayHints
			| SpanMapFeature.SemanticTokens
			| SpanMapFeature.LinkedEditing,
		],
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
});

test('can disable language feature mapping without losing diagnostic spans', () => {
	expect(toSpanMappings(
		[{
			sourceOffsets: [0],
			generatedOffsets: [0],
			lengths: [3],
			data: { semantic: true, navigation: true },
		}],
		'abc',
		'abc',
		false,
	)).toEqual([[0, 3, 0, 3, SpanMapKind.Verbatim, 0]]);
});

test('keeps exact duplicate projections and removes incompatible overlaps', () => {
	expect(toSpanMappings(
		[
			{
				sourceOffsets: [0],
				generatedOffsets: [0],
				lengths: [2],
				data: {},
			},
			{
				sourceOffsets: [0],
				generatedOffsets: [2],
				lengths: [2],
				data: {},
			},
			{
				sourceOffsets: [1],
				generatedOffsets: [4],
				lengths: [2],
				data: {},
			},
			{
				sourceOffsets: [4],
				generatedOffsets: [1],
				lengths: [2],
				data: {},
			},
		],
		'abcdefgh',
		'abefghij',
	)).toEqual([
		[0, 2, 0, 2, SpanMapKind.Verbatim, 0],
		[2, 2, 0, 2, SpanMapKind.Atom, 0],
	]);
});

test('keeps zero-length navigation anchors and drops other zero-length markers', () => {
	const mappings = toSpanMappings(
		[
			{
				sourceOffsets: [0],
				generatedOffsets: [0],
				lengths: [3],
				data: { semantic: true },
			},
			{
				sourceOffsets: [0],
				generatedOffsets: [3],
				lengths: [0],
				data: { navigation: true, semantic: true },
			},
			{
				sourceOffsets: [1],
				generatedOffsets: [3],
				lengths: [0],
				data: { verification: true },
			},
			{
				sourceOffsets: [2],
				generatedOffsets: [3],
				lengths: [0],
				data: { navigation: true, __combineToken: Symbol() },
			},
		],
		'abc',
		'abc',
	);

	expect(mappings).toEqual([
		[
			0,
			3,
			0,
			3,
			SpanMapKind.Verbatim,
			SpanMapFeature.Hover | SpanMapFeature.SignatureHelp | SpanMapFeature.InlayHints | SpanMapFeature.SemanticTokens,
		],
		[
			3,
			0,
			0,
			0,
			SpanMapKind.Verbatim,
			SpanMapFeature.Definition
			| SpanMapFeature.TypeDefinition
			| SpanMapFeature.Implementation
			| SpanMapFeature.References
			| SpanMapFeature.DocumentHighlights
			| SpanMapFeature.Rename
			| SpanMapFeature.CallHierarchy
			| SpanMapFeature.CodeActions
			| SpanMapFeature.LinkedEditing,
		],
	]);
});

test('flattens static rename and highlight callbacks into feature bits', () => {
	const [mapping] = toSpanMappings(
		[{
			sourceOffsets: [0],
			generatedOffsets: [0],
			lengths: [3],
			data: {
				semantic: { shouldHighlight: () => false },
				navigation: {
					shouldHighlight: () => false,
					shouldRename: () => false,
				},
			},
		}],
		'abc',
		'abc',
	);

	expect(mapping![5] & SpanMapFeature.Hover).toBeTruthy();
	expect(mapping![5] & SpanMapFeature.Definition).toBeTruthy();
	expect(mapping![5] & SpanMapFeature.SemanticTokens).toBeFalsy();
	expect(mapping![5] & SpanMapFeature.DocumentHighlights).toBeFalsy();
	expect(mapping![5] & SpanMapFeature.Rename).toBeFalsy();
});

const navigationBits = SpanMapFeature.Definition
	| SpanMapFeature.TypeDefinition
	| SpanMapFeature.Implementation
	| SpanMapFeature.References
	| SpanMapFeature.DocumentHighlights
	| SpanMapFeature.Rename
	| SpanMapFeature.CallHierarchy
	| SpanMapFeature.CodeActions
	| SpanMapFeature.LinkedEditing;

test('merges boundary-wrapped tokens (synthesized quotes) into one span', () => {
	const data = { navigation: true, __combineToken: Symbol() };
	// generated: ----------'a-b'   (quotes at 10 and 14, `a-b` at 11..14)
	// original:  --------------------a-b   (`a-b` at 20..23)
	expect(toSpanMappings(
		[
			{ sourceOffsets: [20], generatedOffsets: [10], lengths: [0], data },
			{ sourceOffsets: [20], generatedOffsets: [11], lengths: [3], data },
			{ sourceOffsets: [23], generatedOffsets: [15], lengths: [0], data },
		],
		`----------'a-b'`,
		`--------------------a-b`,
	)).toEqual([
		[10, 5, 20, 3, SpanMapKind.Atom, navigationBits],
	]);
});

test('merges camelized identifier segments into one span', () => {
	const data = { navigation: true, __combineToken: Symbol() };
	// generated: vOnce   (`v` at 0..1, `Once` at 1..5)
	// original:  v-once  (`v` at 0..1, `once` at 2..6)
	expect(toSpanMappings(
		[
			{ sourceOffsets: [0], generatedOffsets: [0], lengths: [1], data },
			{ sourceOffsets: [2], generatedOffsets: [1], lengths: [4], data },
		],
		'vOnce',
		'v-once',
	)).toEqual([
		[0, 5, 0, 6, SpanMapKind.Atom, navigationBits],
	]);
});

test('keeps single-use combine tokens as individual spans', () => {
	// e.g. `Click` from `@click`: camelized, but a single segment
	const data = { navigation: true, __combineToken: Symbol() };
	expect(toSpanMappings(
		[{ sourceOffsets: [0], generatedOffsets: [0], lengths: [5], data }],
		'Click',
		'click',
	)).toEqual([
		[0, 5, 0, 5, SpanMapKind.Atom, navigationBits],
	]);
});
