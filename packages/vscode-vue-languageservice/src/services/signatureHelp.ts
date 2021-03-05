import type { TsApiRegisterOptions } from '../types';
import {
	Position,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFile';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register({ sourceFiles, tsLanguageService }: TsApiRegisterOptions) {
	return (document: TextDocument, position: Position) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const tsResult = getTsResult(sourceFile);
		if (tsResult) return tsResult;

		function getTsResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const tsRange of sourceMap.getMappedRanges(position)) {
					if (!tsRange.data.capabilities.basic) continue;
					const result = tsLanguageService.getSignatureHelp(sourceMap.mappedDocument.uri, tsRange.start);
					if (result) {
						return result; // TODO: to array
					}
				}
			}
		}
	}
}
