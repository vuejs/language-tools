import type * as vscode from 'vscode';
import diff = require('fast-diff');

/** for test unit */
export type FormatableTextDocument = Pick<vscode.TextDocument, 'getText' | 'offsetAt' | 'positionAt'>;

/** for test unit */
export type TextEditReplace = (start: number, end: number, newText: string) => vscode.TextEdit;

export function restrictFormattingEditsToRange(
	document: FormatableTextDocument,
	range: vscode.Range,
	edits: vscode.TextEdit[],
	replace: TextEditReplace,
) {
	const selectionStart = document.offsetAt(range.start);
	const selectionEnd = document.offsetAt(range.end);
	const result: vscode.TextEdit[] = [];

	for (const edit of edits) {
		const editStart = document.offsetAt(edit.range.start);
		const editEnd = document.offsetAt(edit.range.end);

		if (editStart >= selectionStart && editEnd <= selectionEnd) {
			result.push(edit);
			continue;
		}

		if (editEnd < selectionStart || editStart > selectionEnd) {
			continue;
		}

		const trimmedEdit = getTrimmedNewText(document, selectionStart, selectionEnd, edit, editStart, editEnd);
		if (trimmedEdit) {
			result.push(replace(trimmedEdit.start, trimmedEdit.end, trimmedEdit.newText));
		}
	}

	return result;
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
		return {
			start: editStart,
			end: editEnd,
			newText: edit.newText,
		};
	}
	const oldText = document.getText(edit.range);
	const overlapStart = Math.max(editStart, selectionStart) - editStart;
	const overlapEnd = Math.min(editEnd, selectionEnd) - editStart;
	if (overlapStart === overlapEnd) {
		return;
	}

	const map = createOffsetMap(oldText, edit.newText);
	const newStart = map[overlapStart];
	const newEnd = map[overlapEnd];
	return {
		start: editStart + overlapStart,
		end: editStart + overlapEnd,
		newText: edit.newText.slice(newStart, newEnd),
	};
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
