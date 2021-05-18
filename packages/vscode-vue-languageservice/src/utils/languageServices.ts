import * as CSS from 'vscode-css-languageservice';
import * as HTML from 'vscode-html-languageservice';
import * as Pug from 'vscode-pug-languageservice';
import * as Json from 'vscode-json-languageservice';
import type * as ts from 'typescript';
import * as TS2 from 'vscode-typescript-languageservice';
import { TextDocument } from 'vscode-css-languageservice';
import { fsPathToUri, uriToFsPath } from '@volar/shared';
import * as fs from 'fs';

const fileSystemProvider: HTML.FileSystemProvider = {
    stat: (uri) => {
        return new Promise<HTML.FileStat>((resolve, reject) => {
            fs.stat(uriToFsPath(uri), (err, stats) => {
                if (stats) {
                    resolve({
                        type: stats.isFile() ? HTML.FileType.File
                            : stats.isDirectory() ? HTML.FileType.Directory
                                : stats.isSymbolicLink() ? HTML.FileType.SymbolicLink
                                    : HTML.FileType.Unknown,
                        ctime: stats.ctimeMs,
                        mtime: stats.mtimeMs,
                        size: stats.size,
                    });
                }
                else {
                    reject(err);
                }
            });
        });
    },
    readDirectory: (uri) => {
        return new Promise<[string, HTML.FileType][]>((resolve, reject) => {
            fs.readdir(uriToFsPath(uri), (err, files) => {
                if (files) {
                    resolve(files.map(file => [file, HTML.FileType.File]));
                }
                else {
                    reject(err);
                }
            });
        });
    },
}
export const html = HTML.getLanguageService({ fileSystemProvider });
export const css = CSS.getCSSLanguageService({ fileSystemProvider });
export const scss = CSS.getSCSSLanguageService({ fileSystemProvider });
export const less = CSS.getLESSLanguageService({ fileSystemProvider });
export const pug = Pug.getLanguageService(html);
export const json = Json.getLanguageService({ /* TODO */ });

export const postcss: CSS.LanguageService = {
    ...scss,
    doValidation: (document, stylesheet, documentSettings) => {
        let errors = scss.doValidation(document, stylesheet, documentSettings);
        errors = errors.filter(error => error.code !== 'css-semicolonexpected');
        errors = errors.filter(error => error.code !== 'css-ruleorselectorexpected');
        errors = errors.filter(error => error.code !== 'unknownAtRules');
        return errors;
    },
};

export function getCssLanguageService(lang: string) {
    switch (lang) {
        case 'css': return css;
        case 'scss': return scss;
        case 'less': return less;
        case 'postcss': return postcss;
    }
}

// a cheap ts language service, only has one script
let tsScriptVersion = 0;
let tsScript: ts.IScriptSnapshot | undefined;
let tsService: ts.LanguageService | undefined;
export function getCheapTsService(ts: typeof import('typescript/lib/tsserverlibrary'), code: string) {
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
export function getCheapTsService2(ts: typeof import('typescript/lib/tsserverlibrary'), doc: TextDocument) {
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
