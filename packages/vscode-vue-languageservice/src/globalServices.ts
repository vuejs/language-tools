import * as CSS from 'vscode-css-languageservice';
import * as HTML from 'vscode-html-languageservice';
import * as TS from 'typescript';
import * as TS2 from '@volar/vscode-typescript-languageservice';
import { TextDocument } from 'vscode-css-languageservice';

export const html = HTML.getLanguageService();
export const css = CSS.getCSSLanguageService();
export const scss = CSS.getSCSSLanguageService();
export const less = CSS.getLESSLanguageService();

export function getCssService(lang: string) {
    switch (lang) {
        case 'css': return css;
        case 'scss': return scss;
        case 'less': return less;
        default: return css;
    }
}

// a cheap ts language service, only has one script
let tsScriptVersion = 0;
let tsScript = TS.ScriptSnapshot.fromString('');
const tsService = TS.createLanguageService({
    getCompilationSettings: () => ({}),
    getScriptFileNames: () => ['fake.ts'],
    getScriptVersion: () => tsScriptVersion.toString(),
    getScriptSnapshot: () => tsScript,
    getCurrentDirectory: () => '',
    getDefaultLibFileName: () => '',
});
export function getCheapTsService(code: string) {
    tsScriptVersion++;
    tsScript = TS.ScriptSnapshot.fromString(code);
    return {
        service: tsService,
        scriptName: 'fake.ts',
    };
}

let tsScriptVersion2 = 0;
let tsScript2 = TS.ScriptSnapshot.fromString('');
const tsService2 = TS2.createLanguageService({
    getCompilationSettings: () => ({}),
    getScriptFileNames: () => ['fake.ts'],
    getScriptVersion: () => tsScriptVersion2.toString(),
    getScriptSnapshot: () => tsScript2,
    getCurrentDirectory: () => '',
    getDefaultLibFileName: () => '',
});
export function getCheapTsService2(doc: TextDocument) {
    tsScriptVersion2++;
    tsScript2 = TS.ScriptSnapshot.fromString(doc.getText());
    return {
        service: tsService2,
        doc: doc,
    };
}
