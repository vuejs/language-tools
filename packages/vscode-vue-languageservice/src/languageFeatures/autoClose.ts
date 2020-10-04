import {
	Position,
	Range,
} from 'vscode-languageserver';
import type { SourceFile } from '../sourceFiles';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument, position: Position): string | undefined | null => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const range = Range.create(position, position);

		const htmlResult = getHtmlResult(sourceFile);
		return htmlResult;

		function getHtmlResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				const virtualLocs = sourceMap.findVirtualLocations(range);
				for (const virtualLoc of virtualLocs) {
					const result = sourceMap.languageService.doTagComplete(sourceMap.virtualDocument, virtualLoc.range.start, sourceMap.htmlDocument);
					if (result) return result;
				}
			}
		}
	}
}
