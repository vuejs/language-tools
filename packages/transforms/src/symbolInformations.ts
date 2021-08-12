import * as shared from '@volar/shared';
import type * as vscode from 'vscode-languageserver';
import { transform as transformSymbolInfomation } from './symbolInformation';

export function transform(locations: vscode.SymbolInformation[], getOtherLocation: (location: vscode.Location) => vscode.Location | undefined): vscode.SymbolInformation[] {
	return locations
		.map(location => transformSymbolInfomation(location, getOtherLocation))
		.filter(shared.notEmpty);
}
