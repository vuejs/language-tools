import {
	Position,
	TextDocument,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument, position: Position) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const range = { start: position, end: position };

		const tsResult = getTsResult(sourceFile);
		if (tsResult) return tsResult;

		function getTsResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const tsLoc of sourceMap.findTargets(range)) {
					if (!tsLoc.data.capabilities.basic) continue;
					const result = sourceMap.languageService.getSignatureHelp(sourceMap.targetDocument, tsLoc.range.start);
					if (result) {
						return result; // TODO: to array
					}
				}
			}
		}
	}
}
