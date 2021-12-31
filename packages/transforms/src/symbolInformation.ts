import type * as vscode from 'vscode-languageserver-types';

export function transform<T extends vscode.SymbolInformation>(symbol: T, getOtherLocation: (location: vscode.Location) => vscode.Location | undefined): T | undefined {

	const location = getOtherLocation(symbol.location);
	if (!location) return;

	return {
		...symbol,
		location,
	};
}
