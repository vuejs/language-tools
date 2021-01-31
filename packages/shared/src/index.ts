export * from './path';
export * from './requests';
export * from './types';

import * as path from 'upath';
import type { Range, TextDocument } from 'vscode-languageserver/node';
import { promisify } from 'util';

const validScriptSyntaxs = new Set(['js', 'jsx', 'ts', 'tsx']);

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
export function getValidScriptSyntax(syntax: string) {
    if (validScriptSyntaxs.has(syntax)) {
        return syntax;
    }
    return 'js';
}
export function notEmpty<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}
export function isInsideRange(parent: Range, child: Range) {
    if (child.start.line < parent.start.line) return false;
    if (child.end.line > parent.end.line) return false;
    if (child.start.line === parent.start.line && child.start.character < parent.start.character) return false;
    if (child.end.line === parent.end.line && child.end.character > parent.end.character) return false;
    return true;
}
export function getWordRange(wordPattern: RegExp, range: Range, document: TextDocument): Range | undefined {
    const docText = document.getText();
    const startOffset = document.offsetAt(range.start);
    const endOffset = document.offsetAt(range.end);
    for (const match of docText.matchAll(wordPattern)) {
        if (match.index === undefined) continue;
        const startIndex = match.index;
        const endIndex = match.index + match[0].length;
        if (startOffset >= startIndex && endOffset <= endIndex) {
            return {
                start: document.positionAt(startIndex),
                end: document.positionAt(endIndex),
            };
        }
    }
    return undefined;
}
export function loadVscodeTypescript(appRoot: string): typeof import('typescript') {
    const tsPath = path.join(appRoot, 'extensions', 'node_modules', 'typescript');
    return require(path.toUnix(tsPath));
}
