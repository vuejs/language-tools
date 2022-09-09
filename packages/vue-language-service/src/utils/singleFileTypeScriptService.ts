import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { TextDocument } from 'vscode-languageserver-textdocument';

let projectVersion = 0;
let doc: TextDocument;
let scriptFileName: string;
let scriptSnapshot: ts.IScriptSnapshot;

export const singleFileTypeScriptServiceHost: ts.LanguageServiceHost = {
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

export function updateSingleFileTypeScriptServiceHost(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	_doc: TextDocument,
) {
	projectVersion++;
	doc = _doc;
	scriptFileName = shared.getPathOfUri(_doc.uri);
	scriptSnapshot = ts.ScriptSnapshot.fromString(doc.getText());
}
