import type { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts2 from '@volar/typescript-language-service';
import { URI } from 'vscode-uri';

// Fast dummy TS language service, only has one script.
let dummyProjectVersion = 0;
let dummyTsLs: ts2.LanguageService | undefined;
let doc: TextDocument;
let dummyFileName: string;

export function getDummyTsLs(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	ts2: typeof import('@volar/typescript-language-service'),
	_doc: TextDocument,
	settings: ts2.Settings,
): ts2.LanguageService {
	if (!dummyTsLs) {
		const host: ts.LanguageServiceHost = {
			readFile: () => undefined,
			fileExists: fileName => fileName === dummyFileName,
			getProjectVersion: () => dummyProjectVersion.toString(),
			getScriptVersion: () => dummyProjectVersion.toString(),
			getCompilationSettings: () => ({ allowJs: true, jsx: ts.JsxEmit.Preserve }),
			getScriptFileNames: () => [dummyFileName],
			getScriptSnapshot: fileName => {
				if (fileName === dummyFileName) {
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
			URI.file('/'),
		);
	}
	dummyProjectVersion++;
	doc = _doc;
	dummyFileName = '/dummy' + _doc.uri.substring(_doc.uri.lastIndexOf('.'));
	return dummyTsLs;
}
