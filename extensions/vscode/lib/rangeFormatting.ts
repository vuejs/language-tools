import type * as vscode from 'vscode';
import diff = require('fast-diff');

/** for test unit */
export type FormatableTextDocument = Pick<vscode.TextDocument, 'getText' | 'offsetAt'>;

/** for test unit */
export type TextEditReplace = (range: vscode.Range, newText: string) => vscode.TextEdit;

export function restrictFormattingEditsToRange(
	document: FormatableTextDocument,
	range: vscode.Range,
	edits: vscode.TextEdit[] | null | undefined,
	replace: TextEditReplace,
) {
	if (!edits?.length) {
		return edits;
	}

	if (edits.every(edit => range.contains(edit.range))) {
		return edits;
	}

	const selectionStart = document.offsetAt(range.start);
	const selectionEnd = document.offsetAt(range.end);
	let selectionText = document.getText(range);

	const sortedEdits = [...edits].sort((a, b) => document.offsetAt(b.range.start) - document.offsetAt(a.range.start));

	for (const edit of sortedEdits) {
		const editStart = document.offsetAt(edit.range.start);
		const editEnd = document.offsetAt(edit.range.end);

		if (editEnd <= selectionStart || editStart >= selectionEnd) {
			continue;
		}

		const relativeStart = Math.max(editStart, selectionStart) - selectionStart;
		const relativeEnd = Math.min(editEnd, selectionEnd) - selectionStart;
		const trimmedText = getTrimmedNewText(document, selectionStart, selectionEnd, edit, editStart, editEnd);

		selectionText = selectionText.slice(0, relativeStart) + trimmedText + selectionText.slice(relativeEnd);
	}

	if (selectionText === document.getText(range)) {
		return [];
	}

	return [replace(range, selectionText)];
}

function getTrimmedNewText(
	document: FormatableTextDocument,
	selectionStart: number,
	selectionEnd: number,
	edit: vscode.TextEdit,
	editStart: number,
	editEnd: number,
) {
	if (editStart === editEnd) {
		if (editStart < selectionStart || editStart > selectionEnd) {
			return '';
		}
		return edit.newText;
	}

	const oldText = document.getText(edit.range);
	if (!oldText) {
		return '';
	}

	const overlapStart = Math.max(editStart, selectionStart) - editStart;
	const overlapEnd = Math.min(editEnd, selectionEnd) - editStart;
	if (overlapStart === overlapEnd) {
		return '';
	}

	const map = createOffsetMap(oldText, edit.newText);
	const newStart = map[overlapStart];
	const newEnd = map[overlapEnd];
	return edit.newText.slice(newStart, newEnd);
}

function createOffsetMap(oldText: string, newText: string) {
	const length = oldText.length;
	const map = new Array<number>(length + 1);
	let oldIndex = 0;
	let newIndex = 0;
	map[0] = 0;

	for (const [op, text] of diff(oldText, newText)) {
		if (op === diff.EQUAL) {
			for (let i = 0; i < text.length; i++) {
				oldIndex++;
				newIndex++;
				map[oldIndex] = newIndex;
			}
		}
		else if (op === diff.DELETE) {
			for (let i = 0; i < text.length; i++) {
				oldIndex++;
				map[oldIndex] = Number.NaN;
			}
		}
		else {
			newIndex += text.length;
		}
	}

	map[length] = newIndex;

	let lastDefinedIndex = 0;
	for (let i = 1; i <= length; i++) {
		if (map[i] === undefined || Number.isNaN(map[i])) {
			continue;
		}
		interpolate(map, lastDefinedIndex, i);
		lastDefinedIndex = i;
	}
	if (lastDefinedIndex < length) {
		interpolate(map, lastDefinedIndex, length);
	}

	return map;
}

function interpolate(map: number[], startIndex: number, endIndex: number) {
	const startValue = map[startIndex] ?? 0;
	const endValue = map[endIndex] ?? startValue;
	const gap = endIndex - startIndex;
	if (gap <= 1) {
		return;
	}
	const delta = (endValue - startValue) / gap;
	for (let i = 1; i < gap; i++) {
		const index = startIndex + i;
		if (map[index] !== undefined && !Number.isNaN(map[index])) {
			continue;
		}
		map[index] = Math.floor(startValue + delta * i);
	}
}
