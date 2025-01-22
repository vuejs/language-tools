import type { TextDocument } from 'vscode-languageserver-textdocument';

export function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function isTsDocument(document: TextDocument) {
	return document.languageId === 'javascript' ||
		document.languageId === 'typescript' ||
		document.languageId === 'javascriptreact' ||
		document.languageId === 'typescriptreact';
}