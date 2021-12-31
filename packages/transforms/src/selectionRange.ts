import type * as vscode from 'vscode-languageserver-types';

export function transform<T extends vscode.SelectionRange>(location: T, getOtherRange: (range: vscode.Range) => vscode.Range | undefined): T | undefined {

	const range = getOtherRange(location.range);
	if (!range) return;

	const parent = location.parent ? transform(location.parent as T, getOtherRange) : undefined;

	return {
		range,
		parent,
	} as T;
}
