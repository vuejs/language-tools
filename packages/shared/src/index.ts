export * from './path';
export * from './requests';
export * from './types';
export * from './uriMap';

import * as path from 'upath';
import * as fs from 'fs';
import type { Position, Range, TextDocument } from 'vscode-languageserver/node';
import { promisify } from 'util';
import { MapLike } from 'typescript';

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
export function getWordStart(wordPattern: RegExp, position: Position, document: TextDocument): Position | undefined {
    const lineStart: Position = {
        line: position.line,
        character: 0,
    };
    const lineEnd: Position = {
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
            return document.positionAt(matchStart);
        }
    }
    return undefined;
}
export function loadVscodeTypescript(appRoot: string): typeof import('typescript') {
    const tsPath = path.join(appRoot, 'extensions', 'node_modules', 'typescript');
    return require(path.toUnix(tsPath));
}
export function loadVscodeTypescriptLocalized(appRoot: string, lang: string): MapLike<string> | undefined {
    const tsPath = path.join(appRoot, 'extensions', 'node_modules', 'typescript', 'lib', lang, 'diagnosticMessages.generated.json');
    if (fs.existsSync(tsPath)) {
        return require(path.toUnix(tsPath));
    }
}
