import * as shared from '@volar/shared';
import type * as vscode from 'vscode-languageserver-types';
import { transform as transformSymbolInfomation } from './symbolInformation';

export function transform<T extends vscode.SymbolInformation>(locations: T[], getOtherLocation: (location: vscode.Location) => vscode.Location | undefined): T[] {
	return locations
		.map(location => transformSymbolInfomation(location, getOtherLocation))
		.filter(shared.notEmpty);
}
