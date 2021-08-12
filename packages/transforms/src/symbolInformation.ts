import type * as vscode from 'vscode-languageserver';

export function transform(symbol: vscode.SymbolInformation, getOtherLocation: (location: vscode.Location) => vscode.Location | undefined): vscode.SymbolInformation | undefined {

	const location = getOtherLocation(symbol.location);
	if (!location) return;

	return {
		...symbol,
		location,
	};
}
