import { describe, expect, test } from 'vitest';
import type * as vscode from 'vscode';
import { type FormatableTextDocument, restrictFormattingEditsToRange } from '../src/rangeFormatting';

describe('provideDocumentRangeFormattingEdits', () => {
	test('only replace selected range', () => {
		const document = createDocument('012345');
		const selection = createRange(1, 5);
		const edits = [createTextEdit(0, 5, '_BCDE')];
		const result = restrictFormattingEditsToRange(document, selection, edits, createTextEdit);
		expect(applyEdits(document, result)).toMatchInlineSnapshot(`"_BCDE5"`);
	});

	test('keeps indent when edits start on previous line', () => {
		const content = `<template>
  <div
  >1</div>
  <div>
  <div>2</div>
  </div>
</template>
`;
		const document = createDocument(content);
		const selectionText = `  <div>
  <div>2</div>
  </div>`;
		const selectionStart = content.indexOf(selectionText);
		const selection = createRange(selectionStart, selectionStart + selectionText.length);
		const edits = [
			createTextEdit(
				selection.start.character - 1,
				selection.end.character,
				`\n  <div>
    <div>2</div>
  </div>`,
			),
		];

		const result = restrictFormattingEditsToRange(document, selection, edits, createTextEdit);
		expect(applyEdits(document, result)).toMatchInlineSnapshot(`
			"<template>
			  <div
			  >1</div>
			  <div>
			    <div>2</div>
			  </div>
			</template>
			"
		`);
	});

	test('drops edits if the selection text unchanged after restrict', () => {
		const document = createDocument('0123456789');
		const selection = createRange(2, 5);
		const edits = [createTextEdit(0, 10, '0123456789')];
		const result = restrictFormattingEditsToRange(document, selection, edits, createTextEdit);
		expect(applyEdits(document, result)).toMatchInlineSnapshot(`"0123456789"`);
	});

	test('returns next edits unchanged when they fully match the selection', () => {
		const document = createDocument('0123456789');
		const selection = createRange(2, 7);
		const edits = [createTextEdit(3, 5, 'aa')];
		const result = restrictFormattingEditsToRange(document, selection, edits, createTextEdit);
		expect(applyEdits(document, result)).toMatchInlineSnapshot(`"012aa56789"`);
	});

	test('keeps boundary inserts when other edits are out of range', () => {
		const document = createDocument('0123456789');
		const selection = createRange(2, 5);
		const edits = [
			createTextEdit(5, 6, 'Z'),
			createTextEdit(2, 2, 'X'),
		];
		const result = restrictFormattingEditsToRange(document, selection, edits, createTextEdit);
		expect(applyEdits(document, result)).toMatchInlineSnapshot(`"01X234Z6789"`);
	});

	test('handles deletion where newText is shorter than oldText in selection', () => {
		const document = createDocument('ab  ');
		const selection = createRange(1, 3);
		const edits = [createTextEdit(0, 4, 'ab')];
		const result = restrictFormattingEditsToRange(document, selection, edits, createTextEdit);
		expect(applyEdits(document, result)).toMatchInlineSnapshot(`"ab "`);
	});

	test('handles newText completely exhausted before reaching overlapEnd', () => {
		const document = createDocument('abcdef');
		const selection = createRange(1, 5); // select "bcde"
		const edits = [createTextEdit(0, 6, 'ab')]; // replace all with just "ab"
		const result = restrictFormattingEditsToRange(document, selection, edits, createTextEdit);
		expect(applyEdits(document, result)).toMatchInlineSnapshot(`"ab"`);
	});

	test('handles insertion where newText is longer than oldText', () => {
		const document = createDocument('abc');
		const selection = createRange(1, 2); // select "b"
		const edits = [createTextEdit(0, 3, 'aXYZc')]; // insert XYZ in the middle
		const result = restrictFormattingEditsToRange(document, selection, edits, createTextEdit);
		expect(applyEdits(document, result)).toMatchInlineSnapshot(`"aXYZc"`);
	});

	test('handles whitespace-only differences', () => {
		const document = createDocument('a  b  c');
		const selection = createRange(1, 6); // select "  b  "
		const edits = [createTextEdit(0, 7, 'a b c')]; // normalize spaces
		const result = restrictFormattingEditsToRange(document, selection, edits, createTextEdit);
		expect(applyEdits(document, result)).toMatchInlineSnapshot(`"a b c"`);
	});

	test('handles edit range completely before selection', () => {
		const document = createDocument('0123456789');
		const selection = createRange(5, 8);
		const edits = [createTextEdit(0, 3, 'XYZ')];
		const result = restrictFormattingEditsToRange(document, selection, edits, createTextEdit);
		expect(applyEdits(document, result)).toMatchInlineSnapshot(`"0123456789"`);
	});

	test('handles edit range completely after selection', () => {
		const document = createDocument('0123456789');
		const selection = createRange(2, 5);
		const edits = [createTextEdit(7, 10, 'XYZ')];
		const result = restrictFormattingEditsToRange(document, selection, edits, createTextEdit);
		expect(applyEdits(document, result)).toMatchInlineSnapshot(`"0123456789"`);
	});

	test('handles empty selection', () => {
		const document = createDocument('0123456789');
		const selection = createRange(5, 5); // empty selection at position 5
		const edits = [createTextEdit(3, 7, 'ABCD')];
		const result = restrictFormattingEditsToRange(document, selection, edits, createTextEdit);
		expect(applyEdits(document, result)).toMatchInlineSnapshot(`"012ABCD789"`);
	});

	test('handles empty edit (pure insertion)', () => {
		const document = createDocument('0123456789');
		const selection = createRange(3, 7);
		const edits = [createTextEdit(5, 5, 'XXX')]; // insert at position 5
		const result = restrictFormattingEditsToRange(document, selection, edits, createTextEdit);
		expect(applyEdits(document, result)).toMatchInlineSnapshot(`"01234XXX56789"`);
	});

	test('handles multiple edits within selection', () => {
		const document = createDocument('0123456789');
		const selection = createRange(2, 8);
		const edits = [
			createTextEdit(3, 4, 'A'),
			createTextEdit(6, 7, 'B'),
		];
		const result = restrictFormattingEditsToRange(document, selection, edits, createTextEdit);
		expect(applyEdits(document, result)).toMatchInlineSnapshot(`"012A45B789"`);
	});

	test('handles edit with mixed whitespace and non-whitespace changes', () => {
		const document = createDocument('a\n\tb\n\tc');
		const selection = createRange(1, 5); // select "\n\tb\n"
		const edits = [createTextEdit(0, 7, 'a b c')]; // normalize all whitespace
		const result = restrictFormattingEditsToRange(document, selection, edits, createTextEdit);
		expect(applyEdits(document, result)).toMatchInlineSnapshot(`"a b	c"`);
	});

	test('handles non-ASCII characters', () => {
		const document = createDocument('你好世界');
		const selection = createRange(1, 3); // select "好世"
		const edits = [createTextEdit(0, 4, '你好朋友')];
		const result = restrictFormattingEditsToRange(document, selection, edits, createTextEdit);
		expect(applyEdits(document, result)).toMatchInlineSnapshot(`"你好朋友"`);
	});
});

// self implementation of vscode test utils

function applyEdits(
	document: FormatableTextDocument,
	edits: vscode.TextEdit[],
) {
	let content = document.getText();
	const sortedEdits = edits.slice().sort((a, b) => {
		const aStart = document.offsetAt(a.range.start);
		const bStart = document.offsetAt(b.range.start);
		return bStart - aStart;
	});
	for (const edit of sortedEdits) {
		const start = document.offsetAt(edit.range.start);
		const end = document.offsetAt(edit.range.end);
		content = content.slice(0, start) + edit.newText + content.slice(end);
	}
	return content;
}

function createDocument(content: string): FormatableTextDocument {
	return {
		offsetAt: ({ character }) => character,
		positionAt: (offset: number) => ({ line: 0, character: offset }) as unknown as vscode.Position,
		getText: range => range ? content.slice(range.start.character, range.end.character) : content,
	};
}

function createRange(start: number, end: number): vscode.Range {
	return {
		start: { line: 0, character: start },
		end: { line: 0, character: end },
	} as unknown as vscode.Range;
}

function createTextEdit(start: number, end: number, newText: string) {
	return {
		range: createRange(start, end),
		newText,
	} as unknown as vscode.TextEdit;
}
