import { TextDocument, Position } from 'vscode-languageserver-textdocument';
import * as ts from '@volar/vscode-typescript-languageservice';

export interface TsCompletionData {
	mode: 'ts',
	document: TextDocument,
	languageService: ts.LanguageService,
	position: Position,
}
