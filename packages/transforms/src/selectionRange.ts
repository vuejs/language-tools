import type * as vscode from 'vscode-languageserver';

export function transform(location: vscode.SelectionRange, getOtherRange: (range: vscode.Range) => vscode.Range | undefined): vscode.SelectionRange | undefined {

	const range = getOtherRange(location.range);
	if (!range) return;

	const parent = location.parent ? transform(location.parent, getOtherRange) : undefined;

	return {
		range,
		parent,
	};
}
