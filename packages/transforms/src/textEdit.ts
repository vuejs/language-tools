import { InsertReplaceEdit, Range, TextEdit } from 'vscode-languageserver/node';

export function transform<T extends TextEdit | InsertReplaceEdit>(textEdit: T, getOtherRange: (range: Range) => Range | undefined): T | undefined {
	if (TextEdit.is(textEdit)) {

		const range = getOtherRange(textEdit.range);
		if (!range) return;

		return {
			...textEdit,
			range,
		};
	}
	else if (InsertReplaceEdit.is(textEdit)) {

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
