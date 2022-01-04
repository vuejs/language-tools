import type * as vscode from 'vscode-languageserver-types';
import { transform as transformLocations } from './locationsLike';
import { transform as transformTextEdit } from './textEdit';

export function transform<T extends vscode.CompletionItem>(item: T, getOtherRange: (range: vscode.Range) => vscode.Range | undefined): T {
	return {
		...item,
		additionalTextEdits: item.additionalTextEdits
			? transformLocations(item.additionalTextEdits, getOtherRange)
			: undefined,
		textEdit: item.textEdit
			? transformTextEdit(item.textEdit, getOtherRange)
			: undefined,
	};
}
