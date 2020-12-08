export * from './path';
export * from './requests';
import type { Range } from 'vscode-languageserver/node';

const validScriptSyntaxs = new Set(['js', 'jsx', 'ts', 'tsx']);

export function sleep(ms = 0) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
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
export function randomStr() {
    return [...Array(10)].map(i => (~~(Math.random() * 36)).toString(36)).join('');
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
