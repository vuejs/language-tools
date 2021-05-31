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
export function getWordRange(wordPattern: RegExp, position: Position, document: TextDocument): Range | undefined {
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
            return {
                start: document.positionAt(matchStart),
                end: document.positionAt(matchEnd),
            };
        }
    }
    return undefined;
}
export function loadWorkspaceTypescript(root: string, tsdk: string): typeof import('typescript/lib/tsserverlibrary') | undefined {
    const tsPath = path.isAbsolute(tsdk) ? path.join(tsdk, 'tsserverlibrary.js') : path.join(root, tsdk, 'tsserverlibrary.js');
    if (fs.existsSync(tsPath)) {
        return require(path.toUnix(tsPath));
    }
}
export function loadWorkspaceTypescriptLocalized(root: string, tsdk: string, lang: string): MapLike<string> | undefined {
    const tsPath = path.isAbsolute(tsdk) ? path.join(tsdk, lang, 'diagnosticMessages.generated.json') : path.join(root, tsdk, lang, 'diagnosticMessages.generated.json');
    if (fs.existsSync(tsPath)) {
        return require(path.toUnix(tsPath));
    }
}
export function loadVscodeTypescript(appRoot: string): typeof import('typescript/lib/tsserverlibrary') {
    const tsPath = path.join(appRoot, 'extensions', 'node_modules', 'typescript');
    return require(path.toUnix(tsPath));
}
export function loadVscodeTypescriptLocalized(appRoot: string, lang: string): MapLike<string> | undefined {
    const tsPath = path.join(appRoot, 'extensions', 'node_modules', 'typescript', 'lib', lang, 'diagnosticMessages.generated.json');
    if (fs.existsSync(tsPath)) {
        return require(path.toUnix(tsPath));
    }
}
export function eqSet<T>(as: Set<T>, bs: Set<T>) {
    if (as.size !== bs.size) return false;
    for (const a of as) if (!bs.has(a)) return false;
    return true;
}
