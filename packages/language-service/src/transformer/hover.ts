import * as vscode from 'vscode-languageserver-protocol';

export function transform<T extends vscode.Hover>(hover: T, getOtherRange: (range: vscode.Range) => vscode.Range | undefined): T | undefined {

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
