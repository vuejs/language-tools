import * as shared from '@volar/shared';
import type * as vscode from 'vscode-languageserver';
import { transform as transformSelectionRange } from './selectionRange';

export function transform(locations: vscode.SelectionRange[], getOtherRange: (range: vscode.Range) => vscode.Range | undefined): vscode.SelectionRange[] {
	return locations
		.map(location => transformSelectionRange(location, getOtherRange))
		.filter(shared.notEmpty);
}
