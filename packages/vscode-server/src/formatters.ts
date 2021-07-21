import * as prettyhtml from '@starptech/prettyhtml';
import * as prettier from 'prettier';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver/node';

const pugBeautify = require('pug-beautify');

export function html(document: TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {

	const prefixes = '<template>';
	const suffixes = '</template>';

	let newHtml = prettyhtml(prefixes + document.getText() + suffixes, {
		tabWidth: options.tabSize,
		useTabs: !options.insertSpaces,
		printWidth: 100,
	}).contents;
	newHtml = newHtml.trim();
	newHtml = newHtml.substring(prefixes.length, newHtml.length - suffixes.length);

	const htmlEdit = vscode.TextEdit.replace(
		vscode.Range.create(
			document.positionAt(0),
			document.positionAt(document.getText().length),
		),
		newHtml,
	);

	return [htmlEdit];
}

export function pug(document: TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {

	const pugCode = document.getText();
	if (pugCode.trim() === '') {
		return []; // fix https://github.com/johnsoncodehk/volar/issues/304
	}

	const prefixesLength = pugCode.length - pugCode.trimStart().length;
	const suffixesLength = pugCode.length - pugCode.trimEnd().length;
	const prefixes = pugCode.substr(0, prefixesLength);
	const suffixes = pugCode.substr(pugCode.length - suffixesLength);
	const newPugCode: string = pugBeautify(pugCode, {
		tab_size: options.tabSize,
		fill_tab: !options.insertSpaces,
	});
	const pugEdit = vscode.TextEdit.replace(
		vscode.Range.create(
			document.positionAt(0),
			document.positionAt(pugCode.length),
		),
		prefixes + newPugCode.trim() + suffixes,
	);

	return [pugEdit];
}

export function css(document: TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
	return _css(document, options, 'css');
}

export function less(document: TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
	return _css(document, options, 'less');
}

export function scss(document: TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
	return _css(document, options, 'scss');
}

export function postcss(document: TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
	return _css(document, options, 'postcss');
}

function _css(document: TextDocument, options: vscode.FormattingOptions, languageId: 'css' | 'less' | 'scss' | 'postcss'): vscode.TextEdit[] {

	const newStyleText = prettier.format(document.getText(), {
		tabWidth: options.tabSize,
		useTabs: !options.insertSpaces,
		parser: languageId,
	});
	const cssEdit = vscode.TextEdit.replace(
		vscode.Range.create(
			document.positionAt(0),
			document.positionAt(document.getText().length),
		),
		'\n' + newStyleText
	);

	return [cssEdit];
}
