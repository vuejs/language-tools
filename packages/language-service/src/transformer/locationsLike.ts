import * as shared from '@volar/shared';
import * as vscode from 'vscode-languageserver-protocol';
import { transform as transformLocation } from './locationLike';

export function transform<T extends { range: vscode.Range; }>(locations: T[], getOtherRange: (range: vscode.Range) => vscode.Range | undefined): T[] {
	return locations
		.map(location => transformLocation(location, getOtherRange))
		.filter(shared.notEmpty);
}
