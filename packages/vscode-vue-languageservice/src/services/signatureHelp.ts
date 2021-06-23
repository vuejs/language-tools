import type { Position } from 'vscode-languageserver/node';
import type { SourceFile } from '../sourceFile';
import type { ApiLanguageServiceContext } from '../types';

export function register({ sourceFiles, tsLs }: ApiLanguageServiceContext) {
	return (uri: string, position: Position) => {
		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) return;

		const tsResult = getTsResult(sourceFile);
		if (tsResult) return tsResult;

		function getTsResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const tsRange of sourceMap.getMappedRanges(position)) {
					if (!tsRange.data.capabilities.basic) continue;
					const result = tsLs.getSignatureHelp(sourceMap.mappedDocument.uri, tsRange.start);
					if (result) {
						return result; // TODO: to array
					}
				}
			}
		}
	}
}
