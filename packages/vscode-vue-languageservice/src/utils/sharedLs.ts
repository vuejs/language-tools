import { uriToFsPath } from '@volar/shared';
import * as fs from 'fs';
import type * as ts from 'typescript';
import type { TextDocument } from 'vscode-css-languageservice';
import * as css from 'vscode-css-languageservice';
import * as html from 'vscode-html-languageservice';
import * as json from 'vscode-json-languageservice';
import * as pug from 'vscode-pug-languageservice';
import * as ts2 from 'vscode-typescript-languageservice';

const fileSystemProvider: html.FileSystemProvider = {
    stat: (uri) => {
        return new Promise<html.FileStat>((resolve, reject) => {
            fs.stat(uriToFsPath(uri), (err, stats) => {
                if (stats) {
                    resolve({
                        type: stats.isFile() ? html.FileType.File
                            : stats.isDirectory() ? html.FileType.Directory
                                : stats.isSymbolicLink() ? html.FileType.SymbolicLink
                                    : html.FileType.Unknown,
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
        return new Promise<[string, html.FileType][]>((resolve, reject) => {
            fs.readdir(uriToFsPath(uri), (err, files) => {
                if (files) {
                    resolve(files.map(file => [file, html.FileType.File]));
                }
                else {
                    reject(err);
                }
            });
        });
    },
}
export const htmlLs = html.getLanguageService({ fileSystemProvider });
export const cssLs = css.getCSSLanguageService({ fileSystemProvider });
export const scssLs = css.getSCSSLanguageService({ fileSystemProvider });
export const lessLs = css.getLESSLanguageService({ fileSystemProvider });
export const pugLs = pug.getLanguageService(htmlLs);
export const jsonLs = json.getLanguageService({ /* TODO */ });
export const postcssLs: css.LanguageService = {
    ...scssLs,
    doValidation: (document, stylesheet, documentSettings) => {
        let errors = scssLs.doValidation(document, stylesheet, documentSettings);
        errors = errors.filter(error => error.code !== 'css-semicolonexpected');
        errors = errors.filter(error => error.code !== 'css-ruleorselectorexpected');
        errors = errors.filter(error => error.code !== 'unknownAtRules');
        return errors;
    },
};

export function getCssLs(lang: string) {
    switch (lang) {
        case 'css': return cssLs;
        case 'scss': return scssLs;
        case 'less': return lessLs;
        case 'postcss': return postcssLs;
    }
}

// Fast dummy TS language service, only has one script.
let dummyTsScriptVersionn = 0;
let dummyTsScript: ts.IScriptSnapshot | undefined;
let dummyTsLs: ts2.LanguageService | undefined;
export function getDummyTsLs(ts: typeof import('typescript/lib/tsserverlibrary'), doc: TextDocument) {
    if (!dummyTsLs) {
        dummyTsLs = ts2.createLanguageService(
            {
                getCompilationSettings: () => ({}),
                getScriptFileNames: () => [uriToFsPath(doc.uri)],
                getScriptVersion: () => dummyTsScriptVersionn.toString(),
                getScriptSnapshot: () => dummyTsScript,
                getCurrentDirectory: () => '',
                getDefaultLibFileName: () => '',
            },
            ts,
        );
    }
    dummyTsScriptVersionn++;
    dummyTsScript = ts.ScriptSnapshot.fromString(doc.getText());
    return dummyTsLs;
}
