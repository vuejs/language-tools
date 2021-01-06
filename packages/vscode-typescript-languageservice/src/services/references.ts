import type * as ts from 'typescript';
import {
	Location,
	TextDocument,
	Position,
} from 'vscode-languageserver/node';
import { entriesToLocations } from '../utils/transforms';
import { uriToFsPath } from '@volar/shared';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (uri: string, position: Position): Location[] => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const entries = languageService.getReferencesAtPosition(fileName, offset);
		if (!entries) return [];

		return entriesToLocations([...entries], getTextDocument);
	};
}
