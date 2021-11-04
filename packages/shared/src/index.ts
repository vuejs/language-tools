export * from './path';
export * from './requests';
export * from './types';
export * from './uriMap';
export * from './ts';
export * from './http';
export * from './vue';

import type * as vscode from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { promisify } from 'util';

export const sleep = promisify(setTimeout);

export function syntaxToLanguageId(syntax: string) {
	switch (syntax) {
		case 'js': return 'javascript';
		case 'ts': return 'typescript';
		case 'jsx': return 'javascriptreact';
		case 'tsx': return 'typescriptreact';
		case 'pug': return 'jade';
	}
	return syntax;
}

export function languageIdToSyntax(languageId: string) {
	switch (languageId) {
		case 'javascript': return 'js';
		case 'typescript': return 'ts';
		case 'javascriptreact': return 'jsx';
		case 'typescriptreact': return 'tsx';
		case 'jade': return 'pug';
	}
	return languageId;
}

export function notEmpty<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}

export function isInsideRange(parent: vscode.Range, child: vscode.Range) {
	if (child.start.line < parent.start.line) return false;
	if (child.end.line > parent.end.line) return false;
	if (child.start.line === parent.start.line && child.start.character < parent.start.character) return false;
	if (child.end.line === parent.end.line && child.end.character > parent.end.character) return false;
	return true;
}

export function getWordRange(wordPattern: RegExp, position: vscode.Position, document: TextDocument): vscode.Range | undefined {
	const lineStart: vscode.Position = {
		line: position.line,
		character: 0,
	};
	const lineEnd: vscode.Position = {
		line: position.line + 1,
		character: 0,
	};
	const offset = document.offsetAt(position);
	const lineStartOffset = document.offsetAt(lineStart);
	const lineText = document.getText({ start: lineStart, end: lineEnd });
	for (const match of lineText.matchAll(wordPattern)) {
		if (match.index === undefined) continue;
		const matchStart = match.index + lineStartOffset;
		const matchEnd = matchStart + match[0].length;
		if (offset >= matchStart && offset <= matchEnd) {
			return {
				start: document.positionAt(matchStart),
				end: document.positionAt(matchEnd),
			};
		}
	}
	return undefined;
}

export function eqSet<T>(as: Set<T>, bs: Set<T>) {
	if (as.size !== bs.size) return false;
	for (const a of as) if (!bs.has(a)) return false;
	return true;
}

export function getDocumentSafely(documents: vscode.TextDocuments<TextDocument>, uri: string) {

	const normalizeUri = URI.parse(uri).toString();
	const document = documents.get(uri) ?? documents.get(normalizeUri);

	if (document) {
		return document;
	}

	for (const document of documents.all()) {
		if (URI.parse(document.uri).toString() === normalizeUri) {
			return document;
		}
	}
}
