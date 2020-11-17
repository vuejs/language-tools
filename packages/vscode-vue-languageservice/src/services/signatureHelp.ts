import {
	Position,
	TextDocument,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import type * as ts2 from '@volar/vscode-typescript-languageservice';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	return (document: TextDocument, position: Position) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const range = { start: position, end: position };

		const tsResult = getTsResult(sourceFile);
		if (tsResult) return tsResult;

		function getTsResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const tsLoc of sourceMap.sourceToTargets(range)) {
					if (!tsLoc.maped.data.capabilities.basic) continue;
					const result = tsLanguageService.getSignatureHelp(sourceMap.targetDocument, tsLoc.range.start);
					if (result) {
						return result; // TODO: to array
					}
				}
			}
		}
	}
}
