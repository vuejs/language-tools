import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts2 from 'vscode-typescript-languageservice';

// Fast dummy TS language service, only has one script.
let dummyTsScriptVersion = 0;
let dummyTsScriptFile = `dummy.${dummyTsScriptVersion}.ts`;
let dummyTsScriptKind = 3;
let dummyTsScript: ts.IScriptSnapshot | undefined;
let dummyTsLs: ts2.LanguageService | undefined;
export function getDummyTsLs(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	ts2: typeof import('vscode-typescript-languageservice'),
	doc: TextDocument,
	getPreferences: ts2.LanguageServiceHost['getPreferences'],
	getFormatOptions: ts2.LanguageServiceHost['getFormatOptions'],
) {
	if (!dummyTsLs) {
		const host: ts2.LanguageServiceHost = {
			getPreferences,
			getFormatOptions,
			getCompilationSettings: () => ({ allowJs: true, jsx: ts.JsxEmit.Preserve }),
			getScriptFileNames: () => [shared.normalizeFileName(dummyTsScriptFile)],
			getScriptVersion: () => dummyTsScriptVersion.toString(),
			getScriptSnapshot: () => dummyTsScript,
			getScriptKind: () => dummyTsScriptKind,
			getCurrentDirectory: () => '',
			getDefaultLibFileName: () => '',
		};
		dummyTsLs = ts2.createLanguageService(
			ts,
			host,
			ts.createLanguageService(host),
		);
	}
	dummyTsScriptFile = `dummy.${dummyTsScriptVersion}.${shared.languageIdToSyntax(doc.languageId)}`;
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
		uri: shared.fsPathToUri(dummyTsScriptFile),
	};
}
