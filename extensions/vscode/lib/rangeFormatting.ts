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

	let oldTextIndex = 0;
	let newTextIndex = 0;
	let newStart = 0;
	let newEnd = edit.newText.length;

	while (true) {
		if (oldTextIndex <= overlapStart) {
			newStart = newTextIndex;
		}
		if (oldTextIndex === overlapEnd) {
			newEnd = newTextIndex;
			break;
		}
		const oldCharCode = oldText.charCodeAt(oldTextIndex);
		const newCharCode = edit.newText.charCodeAt(newTextIndex);
		if (oldCharCode === newCharCode || (!isWhitespaceChar(oldCharCode) && !isWhitespaceChar(newCharCode))) {
			oldTextIndex++;
			newTextIndex++;
			continue;
		}
		if (isWhitespaceChar(oldCharCode)) {
			oldTextIndex++;
		}
		if (isWhitespaceChar(newCharCode)) {
			newTextIndex++;
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
