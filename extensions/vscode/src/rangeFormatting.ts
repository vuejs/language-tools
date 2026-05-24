import type * as vscode from 'vscode';

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

		if (editStart === editEnd) {
			result.push(edit);
			continue;
		}

		const trimmedEdit = getTrimmedNewText(document, selectionStart, selectionEnd, edit, editStart, editEnd);
		result.push(replace(trimmedEdit.start, trimmedEdit.end, trimmedEdit.newText));
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
	const oldText = document.getText(edit.range);
	let overlapStart = Math.max(editStart, selectionStart) - editStart;
	let overlapEnd = Math.min(editEnd, selectionEnd) - editStart;
	let oldTextIndex = 0;
	let newTextIndex = 0;
	let newStart!: number;
	let newEnd!: number;

	while (true) {
		if (oldTextIndex === overlapStart) {
			newStart = newTextIndex;
			break;
		}
		const oldCharCode = oldText.charCodeAt(oldTextIndex);
		const newCharCode = edit.newText.charCodeAt(newTextIndex);
		if (oldCharCode === newCharCode) {
			oldTextIndex++;
			newTextIndex++;
			continue;
		}
		if (!isWhitespaceChar(oldCharCode) && !isWhitespaceChar(newCharCode)) {
			newStart = newTextIndex;
			overlapStart = oldTextIndex;
			break;
		}
		if (isWhitespaceChar(oldCharCode)) {
			oldTextIndex++;
		}
		if (isWhitespaceChar(newCharCode)) {
			newTextIndex++;
		}
	}

	oldTextIndex = oldText.length - 1;
	newTextIndex = edit.newText.length - 1;

	while (true) {
		if (oldTextIndex + 1 === overlapEnd) {
			newEnd = newTextIndex + 1;
			break;
		}
		const oldCharCode = oldText.charCodeAt(oldTextIndex);
		const newCharCode = edit.newText.charCodeAt(newTextIndex);
		if (oldCharCode === newCharCode) {
			oldTextIndex--;
			newTextIndex--;
			continue;
		}
		if (!isWhitespaceChar(oldCharCode) && !isWhitespaceChar(newCharCode)) {
			newEnd = newTextIndex + 1;
			overlapEnd = oldTextIndex + 1;
			break;
		}
		if (isWhitespaceChar(oldCharCode)) {
			oldTextIndex--;
		}
		if (isWhitespaceChar(newCharCode)) {
			newTextIndex--;
		}
	}

	return {
		start: editStart + overlapStart,
		end: editStart + overlapEnd,
		newText: edit.newText.slice(newStart, newEnd),
	};
}

function isWhitespaceChar(charCode: number) {
	return charCode === 32 || charCode === 9 || charCode === 10 || charCode === 13;
}
