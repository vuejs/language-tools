import * as CSS from 'vscode-css-languageservice';
import * as HTML from 'vscode-html-languageservice';
import type * as ts from 'typescript';
import * as TS2 from '@volar/vscode-typescript-languageservice';
import { TextDocument } from 'vscode-css-languageservice';
import { fsPathToUri, uriToFsPath } from '@volar/shared';

export const html = HTML.getLanguageService();
export const css = CSS.getCSSLanguageService();
export const scss = CSS.getSCSSLanguageService();
export const less = CSS.getLESSLanguageService();

export function getCssLanguageService(lang: string) {
    switch (lang) {
        case 'css': return css;
        case 'scss': return scss;
        case 'less': return less;
    }
}

// a cheap ts language service, only has one script
let tsScriptVersion = 0;
let tsScript: ts.IScriptSnapshot | undefined;
let tsService: ts.LanguageService | undefined;
export function getCheapTsService(ts: typeof import('typescript'), code: string) {
    if (!tsService) {
        tsService = ts.createLanguageService({
            getCompilationSettings: () => ({}),
            getScriptFileNames: () => ['fake.ts'],
            getScriptVersion: () => tsScriptVersion.toString(),
            getScriptSnapshot: () => tsScript,
            getCurrentDirectory: () => '',
            getDefaultLibFileName: () => '',
        });
    }
    tsScriptVersion++;
    tsScript = ts.ScriptSnapshot.fromString(code);
    return {
        service: tsService,
        scriptName: 'fake.ts',
    };
}

let tsScriptVersion2 = 0;
let tsScript2: ts.IScriptSnapshot | undefined;
let tsService2: TS2.LanguageService | undefined;
export function getCheapTsService2(ts: typeof import('typescript'), doc: TextDocument) {
    if (!tsService2) {
        tsService2 = TS2.createLanguageService(
            {
                getCompilationSettings: () => ({}),
                getScriptFileNames: () => [uriToFsPath(fsPathToUri('fake.ts'))],
                getScriptVersion: () => tsScriptVersion2.toString(),
                getScriptSnapshot: () => tsScript2,
                getCurrentDirectory: () => '',
                getDefaultLibFileName: () => '',
            },
            ts,
        );
    }
    tsScriptVersion2++;
    tsScript2 = ts.ScriptSnapshot.fromString(doc.getText());
    return {
        service: tsService2,
        uri: fsPathToUri('fake.ts'),
    };
}
