import * as shared from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts2 from '@volar/typescript-language-service';

// Fast dummy TS language service, only has one script.
let dummyProjectVersion = 0;
let dummyTsLs: ts2.LanguageService | undefined;
let doc: TextDocument;

export function getDummyTsLs(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	ts2: typeof import('@volar/typescript-language-service'),
	_doc: TextDocument,
	settings: ts2.Settings,
): ts2.LanguageService {
	if (!dummyTsLs) {
		const host: ts.LanguageServiceHost = {
			readFile: () => undefined,
			fileExists: fileName => shared.fsPathToUri(fileName) === shared.normalizeUri(doc.uri),
			getProjectVersion: () => dummyProjectVersion.toString(),
			getScriptVersion: () => dummyProjectVersion.toString(),
			getCompilationSettings: () => ({ allowJs: true, jsx: ts.JsxEmit.Preserve }),
			getScriptFileNames: () => [shared.uriToFsPath(doc.uri)],
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
			settings,
		);
	}
	dummyProjectVersion++;
	doc = _doc;
	return dummyTsLs;
}
