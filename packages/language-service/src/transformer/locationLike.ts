import * as vscode from 'vscode-languageserver-protocol';

export function transform<T extends { range: vscode.Range; }>(location: T, getOtherRange: (range: vscode.Range) => vscode.Range | undefined): T | undefined {

	const range = getOtherRange(location.range);
	if (!range) return;

	return {
		...location,
		range,
	};
}
