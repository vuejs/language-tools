import type { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts2 from '@volar/typescript-language-service';
import { URI } from 'vscode-uri';
import * as shared from '@volar/shared';

let projectVersion = 0;
let doc: TextDocument;
let scriptFileName: string;
let scriptSnapshot: ts.IScriptSnapshot;
let service: ts2.LanguageService | undefined;

const host: ts.LanguageServiceHost = {
	readFile: () => undefined,
	fileExists: fileName => fileName === scriptFileName,
	getProjectVersion: () => projectVersion.toString(),
	getScriptVersion: () => projectVersion.toString(),
	getCompilationSettings: () => ({ allowJs: true, jsx: 1 }),
	getScriptFileNames: () => [scriptFileName],
	getScriptSnapshot: fileName => {
		if (fileName === scriptFileName) {
			return scriptSnapshot;
		}
	},
	getCurrentDirectory: () => '',
	getDefaultLibFileName: () => '',
};

export function getSingleFileTypeScriptService(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	ts2: typeof import('@volar/typescript-language-service'),
	_doc: TextDocument,
	getConfiguration: (section: string) => Promise<any>,
): ts2.LanguageService {
	if (!service) {
		service = ts2.createLanguageService(
			ts,
			host,
			ts.createLanguageService(host),
			getConfiguration,
			URI.file('/'),
		);
	}
	projectVersion++;
	doc = _doc;
	scriptFileName = shared.getPathOfUri(_doc.uri);
	scriptSnapshot = ts.ScriptSnapshot.fromString(doc.getText());
	return service;
}
