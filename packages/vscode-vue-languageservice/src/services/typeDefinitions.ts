import {
	Position,
	TextDocument,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFiles';
import { tsDefinitionWorker } from './definitions';
import { tsLocationToVueLocations } from '../utils/commons';
import type * as ts2 from '@volar/vscode-typescript-languageservice';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	return (document: TextDocument, position: Position, ignoreTsResult = false) => {

		if (document.languageId !== 'vue') {
			const tsLocs = tsLanguageService.findTypeDefinition(document.uri, position);
			let result = tsLocs.map(tsLoc => tsLocationToVueLocations(tsLoc, sourceFiles)).flat();
			if (ignoreTsResult) {
				result = result.filter(loc => sourceFiles.has(loc.uri)); // duplicate
			}
			return result;
		}

		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const tsResult = tsDefinitionWorker(sourceFile, position, sourceFiles, tsLanguageService.findTypeDefinition);
		return tsResult;
	}
}
