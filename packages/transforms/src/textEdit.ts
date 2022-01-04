import * as vscode from 'vscode-languageserver-types';

export function transform<T extends vscode.TextEdit | vscode.InsertReplaceEdit>(textEdit: T, getOtherRange: (range: vscode.Range) => vscode.Range | undefined): T | undefined {
	if (vscode.TextEdit.is(textEdit)) {

		const range = getOtherRange(textEdit.range);
		if (!range) return;

		return {
			...textEdit,
			range,
		};
	}
	else if (vscode.InsertReplaceEdit.is(textEdit)) {

		const insert = getOtherRange(textEdit.insert);
		if (!insert) return;

		const replace = getOtherRange(textEdit.replace);
		if (!replace) return;

		return {
			...textEdit,
			insert,
			replace,
		};
	}
}
