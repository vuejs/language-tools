import * as ts from 'typescript';
import {
	Location,
	TextDocument,
	Position,
} from 'vscode-languageserver';
import { entriesToLocations } from '../utils/transforms';
import { uriToFsPath } from '@volar/shared';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (document: TextDocument, position: Position): Location[] => {
		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const entries = languageService.getDefinitionAtPosition(fileName, offset);
		if (!entries) return [];

		return entriesToLocations([...entries], getTextDocument);
	};
}
