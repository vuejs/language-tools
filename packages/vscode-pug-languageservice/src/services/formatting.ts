import * as vscode from 'vscode-languageserver';
import type { PugDocument } from '../pugDocument';

const pugBeautify = require('pug-beautify');

export function register() {
	return (pugDoc: PugDocument, options: vscode.FormattingOptions) => {

		if (pugDoc.pugCode.trim() === '') {
			return []; // fix https://github.com/johnsoncodehk/volar/issues/304
		}

		const prefixesLength = pugDoc.pugCode.length - pugDoc.pugCode.trimStart().length;
		const suffixesLength = pugDoc.pugCode.length - pugDoc.pugCode.trimEnd().length;
		const prefixes = pugDoc.pugCode.substr(0, prefixesLength);
		const suffixes = pugDoc.pugCode.substr(pugDoc.pugCode.length - suffixesLength);
		const newPugCode: string = pugBeautify(pugDoc.pugCode, {
			tab_size: options.tabSize,
			fill_tab: !options.insertSpaces,
		});
		const replaceEdit = vscode.TextEdit.replace(
			vscode.Range.create(
				pugDoc.pugTextDocument.positionAt(0),
				pugDoc.pugTextDocument.positionAt(pugDoc.pugCode.length),
			),
			prefixes + newPugCode.trim() + suffixes,
		);

		return [replaceEdit];
	}
}
