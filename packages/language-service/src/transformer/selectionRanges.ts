import * as shared from '@volar/shared';
import * as vscode from 'vscode-languageserver-protocol';
import { transform as transformSelectionRange } from './selectionRange';

export function transform<T extends vscode.SelectionRange>(locations: T[], getOtherRange: (range: vscode.Range) => vscode.Range | undefined): T[] {
	return locations
		.map(location => transformSelectionRange(location, getOtherRange))
		.filter(shared.notEmpty);
}
