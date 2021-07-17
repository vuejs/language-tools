import type * as vscode from 'vscode-languageserver';

export function transform(hover: vscode.Hover, getOtherRange: (range: vscode.Range) => vscode.Range | undefined): vscode.Hover | undefined {

	if (!hover?.range) {
		return hover;
	}

	const range = getOtherRange(hover.range);
	if (!range) return;

	return {
		...hover,
		range,
	};
}
