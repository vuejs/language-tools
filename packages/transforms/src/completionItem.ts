import type * as vscode from 'vscode-languageserver';
import { transform as transformLocations } from './locationsLike';
import { transform as transformTextEdit } from './textEdit';

export function transform(item: vscode.CompletionItem, getOtherRange: (range: vscode.Range) => vscode.Range | undefined): vscode.CompletionItem {
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
