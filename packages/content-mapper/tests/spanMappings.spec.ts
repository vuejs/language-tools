import { expect, test } from 'vitest';
import {
	SpanMapFeature,
	SpanMapKind,
} from '../protocol';
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
				| SpanMapFeature.SourceDefinition
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
