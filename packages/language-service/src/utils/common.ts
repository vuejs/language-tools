import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function getOverlapRange(
	range1Start: number,
	range1End: number,
	range2Start: number,
	range2End: number,
): { start: number, end: number; } | undefined {

	const start = Math.max(range1Start, range2Start);
	const end = Math.min(range1End, range2End);

	if (start > end)
		return undefined;

	return {
		start,
		end,
	};
}

export function isInsideRange(parent: vscode.Range, child: vscode.Range) {
	if (child.start.line < parent.start.line) return false;
	if (child.end.line > parent.end.line) return false;
	if (child.start.line === parent.start.line && child.start.character < parent.start.character) return false;
	if (child.end.line === parent.end.line && child.end.character > parent.end.character) return false;
	return true;
}

export function getWordRange(wordPattern: RegExp, position: vscode.Position, document: TextDocument): vscode.Range | undefined {
	const lineStart: vscode.Position = {
		line: position.line,
		character: 0,
	};
	const lineEnd: vscode.Position = {
		line: position.line + 1,
		character: 0,
	};
	const offset = document.offsetAt(position);
	const lineStartOffset = document.offsetAt(lineStart);
	const lineText = document.getText({ start: lineStart, end: lineEnd });
	for (const match of lineText.matchAll(wordPattern)) {
		if (match.index === undefined) continue;
		const matchStart = match.index + lineStartOffset;
		const matchEnd = matchStart + match[0].length;
		if (offset >= matchStart && offset <= matchEnd) {
			return {
				start: document.positionAt(matchStart),
				end: document.positionAt(matchEnd),
			};
		}
	}
	return undefined;
}

export function stringToSnapshot(str: string): ts.IScriptSnapshot {
	return {
		getText: (start, end) => str.substring(start, end),
		getLength: () => str.length,
		getChangeRange: () => undefined,
	};
}
