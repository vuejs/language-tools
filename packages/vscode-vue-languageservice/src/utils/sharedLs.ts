import { fsPathToUri, uriToFsPath } from '@volar/shared';
import type * as ts from 'typescript';
import type { TextDocument } from 'vscode-css-languageservice';
import * as ts2 from 'vscode-typescript-languageservice';

// Fast dummy TS language service, only has one script.
let dummyTsScriptVersion = 0;
let dummyTsScriptKind = 3;
let dummyTsScript: ts.IScriptSnapshot | undefined;
let dummyTsLs: ts2.LanguageService | undefined;
export function getDummyTsLs(ts: typeof import('typescript/lib/tsserverlibrary'), doc: TextDocument) {
    if (!dummyTsLs) {
        dummyTsLs = ts2.createLanguageService(
            {
                getCompilationSettings: () => ({}),
                getScriptFileNames: () => [uriToFsPath(fsPathToUri(`dummy.${dummyTsScriptVersion}.ts`))],
                getScriptVersion: () => dummyTsScriptVersion.toString(),
                getScriptSnapshot: () => dummyTsScript,
                getScriptKind: () => dummyTsScriptKind,
                getCurrentDirectory: () => '',
                getDefaultLibFileName: () => '',
            },
            ts,
        );
    }
    dummyTsScriptVersion++;
    switch (doc.languageId) {
        case 'javascript': dummyTsScriptKind = ts.ScriptKind.JS; break;
        case 'typescript': dummyTsScriptKind = ts.ScriptKind.TS; break;
        case 'javascriptreact': dummyTsScriptKind = ts.ScriptKind.JSX; break;
        case 'typescriptreact': dummyTsScriptKind = ts.ScriptKind.TSX; break;
        default: dummyTsScriptKind = ts.ScriptKind.TS; break;
    }
    dummyTsScript = ts.ScriptSnapshot.fromString(doc.getText());
    return {
        ls: dummyTsLs,
        uri: fsPathToUri(`dummy.${dummyTsScriptVersion}.ts`),
    };
}
