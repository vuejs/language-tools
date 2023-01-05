import * as vscode from 'vscode-languageserver-types';
import { transform as transformTextEdit } from './textEdit';
import * as shared from '@volar/shared';

export function transform<T extends vscode.CompletionItem>(
	item: T,
	getOtherRange: (range: vscode.Range) => vscode.Range | undefined,
	document: vscode.TextDocument,
): T {
	return {
		...item,
		additionalTextEdits: item.additionalTextEdits
			?.map(edit => transformTextEdit(edit, getOtherRange, document))
			.filter(shared.notEmpty),
		textEdit: item.textEdit
			? transformTextEdit(item.textEdit, getOtherRange, document)
			: undefined,
	};
}
