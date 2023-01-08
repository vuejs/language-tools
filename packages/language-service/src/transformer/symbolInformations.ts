import * as shared from '@volar/shared';
import * as vscode from 'vscode-languageserver-protocol';
import { transform as transformSymbolInformation } from './symbolInformation';

export function transform<T extends vscode.SymbolInformation>(locations: T[], getOtherLocation: (location: vscode.Location) => vscode.Location | undefined): T[] {
	return locations
		.map(location => transformSymbolInformation(location, getOtherLocation))
		.filter(shared.notEmpty);
}
