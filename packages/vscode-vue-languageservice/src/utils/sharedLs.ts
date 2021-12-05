import * as shared from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts2 from 'vscode-typescript-languageservice';

// Fast dummy TS language service, only has one script.
let dummyProjectVersion = 0;
let dummyTsLs: ts2.LanguageService | undefined;
let doc: TextDocument;

export function getDummyTsLs(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	ts2: typeof import('vscode-typescript-languageservice'),
	_doc: TextDocument,
	getPreferences: ts2.LanguageServiceHost['getPreferences'],
	getFormatOptions: ts2.LanguageServiceHost['getFormatOptions'],
) {
	if (!dummyTsLs) {
		const host: ts2.LanguageServiceHost = {
			getProjectVersion: () => dummyProjectVersion.toString(),
			getPreferences,
			getFormatOptions,
			getCompilationSettings: () => ({ allowJs: true, jsx: ts.JsxEmit.Preserve }),
			getScriptFileNames: () => [shared.uriToFsPath(doc.uri)],
			getScriptVersion: (fileName) => {
				if (shared.fsPathToUri(fileName) === doc.uri) {
					return doc.version.toString();
				}
				return '';
			},
			getScriptSnapshot: fileName => {
				if (shared.fsPathToUri(fileName) === shared.normalizeUri(doc.uri)) {
					return ts.ScriptSnapshot.fromString(doc.getText());
				}
			},
			getCurrentDirectory: () => '',
			getDefaultLibFileName: () => '',
		};
		dummyTsLs = ts2.createLanguageService(
			ts,
			host,
			ts.createLanguageService(host),
		);
	}
	dummyProjectVersion++;
	doc = _doc;
	return dummyTsLs;
}
