import {
	Position,
	TextDocument,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import { tsDefinitionWorker } from './definitions';
import { getSourceTsLocations } from '../utils/commons';
import type * as ts2 from '@volar/vscode-typescript-languageservice';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	return (document: TextDocument, position: Position) => {

		if (document.languageId !== 'vue') {
			const tsLocs = tsLanguageService.findTypeDefinition(document, position);
			return tsLocs.map(tsLoc => getSourceTsLocations(tsLoc, sourceFiles)).flat();
		}

		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const tsResult = tsDefinitionWorker(sourceFile, position, sourceFiles, true, tsLanguageService);
		return tsResult;
	}
}
