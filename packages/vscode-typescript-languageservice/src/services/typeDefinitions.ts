import type * as ts from 'typescript';
import {
	Location,
	Position,
} from 'vscode-languageserver/node';
import { entriesToLocations } from '../utils/transforms';
import { uriToFsPath } from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (uri: string, position: Position): Location[] => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const entries = languageService.getTypeDefinitionAtPosition(fileName, offset);
		if (!entries) return [];

		return entriesToLocations([...entries], getTextDocument);
	};
}
