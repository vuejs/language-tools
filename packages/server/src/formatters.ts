import * as prettyhtml from '@starptech/prettyhtml';
import * as prettier from 'prettier';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver/node';

const pugBeautify = require('pug-beautify');

export function getFormatters(getPrintWidth: (uri: string) => number | Promise<number>) {
	return {
		html: (document: TextDocument, options: vscode.FormattingOptions) => html(document, options, getPrintWidth),
		pug,
		css,
		less,
		scss,
		postcss,
	}
}

async function html(document: TextDocument, options: vscode.FormattingOptions, getPrintWidth: (uri: string) => number | Promise<number>) {

	const prefixes = '<template>';
	const suffixes = '</template>';

	let newHtml = prettyhtml(prefixes + document.getText() + suffixes, {
		tabWidth: options.tabSize,
		useTabs: !options.insertSpaces,
		printWidth: await getPrintWidth(document.uri),
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

function pug(document: TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {

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

function css(document: TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
	return _css(document, options, 'css');
}

function less(document: TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
	return _css(document, options, 'less');
}

function scss(document: TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
	return _css(document, options, 'scss');
}

function postcss(document: TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
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
