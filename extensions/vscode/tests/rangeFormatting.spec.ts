import { describe, expect, test } from 'vitest';
import type * as vscode from 'vscode';
import {
	type FormatableTextDocument,
	restrictFormattingEditsToRange,
	type TextEditReplace,
} from '../lib/rangeFormatting';

const textEditReplace: TextEditReplace = (range, newText) => ({ range, newText });

describe('provideDocumentRangeFormattingEdits', () => {
	test('only replace selected range', () => {
		const document = createDocument('012345');
		const selection = createRange(1, 5);
		const edits = [createTextEdit(0, 5, '_BCDE')];
		const result = restrictFormattingEditsToRange(document, selection, edits, textEditReplace);
		expect(result).toEqual([textEditReplace(selection, 'BCDE')]);
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
				`  <div>
    <div>2</div>
  </div>`,
			),
		];

		const result = restrictFormattingEditsToRange(document, selection, edits, textEditReplace);

		expect(result).toEqual([textEditReplace(
			selection,
			`  <div>
    <div>2</div>
  </div>`,
		)]);
	});

	test('drops edits if the selection text unchanged after restrict', () => {
		const document = createDocument('0123456789');
		const selection = createRange(2, 5);
		const edits = [createTextEdit(0, 10, '0123456789')];
		const result = restrictFormattingEditsToRange(document, selection, edits, textEditReplace);
		expect(result).toEqual([]);
	});

	test('returns next edits unchanged when they fully match the selection', () => {
		const document = createDocument('0123456789');
		const selection = createRange(2, 7);
		const edits = [createTextEdit(3, 5, 'aa')];
		const result = restrictFormattingEditsToRange(document, selection, edits, textEditReplace);
		expect(result).toBe(edits);
	});

	test('keeps boundary inserts when other edits are out of range', () => {
		const document = createDocument('0123456789');
		const selection = createRange(2, 5);
		const edits = [
			createTextEdit(5, 6, 'Z'),
			createTextEdit(2, 2, 'X'),
		];
		const result = restrictFormattingEditsToRange(document, selection, edits, textEditReplace);
		expect(result).toEqual([textEditReplace(selection, 'X234')]);
	});
});

// self implementation of vscode test utils

function createDocument(content: string): FormatableTextDocument {
	return {
		offsetAt: ({ character }) => character,
		getText: range => range ? content.slice(range.start.character, range.end.character) : content,
	};
}

function createRange(start: number, end: number): vscode.Range {
	const position = (character: number) => ({ line: 0, character });
	return {
		start: position(start),
		end: position(end),
		contains(value: vscode.Range | vscode.Position) {
			if ('start' in value && 'end' in value) {
				return start <= value.start.character && end >= value.end.character;
			}
			return start <= value.character && end >= value.character;
		},
		isEqual(other: vscode.Range) {
			return other.start.character === start && other.end.character === end;
		},
	} as unknown as vscode.Range;
}

function createTextEdit(start: number, end: number, newText: string) {
	return textEditReplace(createRange(start, end), newText);
}
