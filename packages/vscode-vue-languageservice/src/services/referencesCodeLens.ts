import type * as vscode from 'vscode-languageserver-protocol';
import type { ApiLanguageServiceContext } from '../types';

export interface ReferencesCodeLensData {
	lsType: 'template' | 'script',
	uri: string,
	offset: number,
	tsUri: string,
	tsOffset: number,
}

export function register({ sourceFiles }: ApiLanguageServiceContext) {
	return (uri: string) => {

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) return [];

		const document = sourceFile.getTextDocument();
		const result: vscode.CodeLens[] = [];

		for (const sourceMap of sourceFile.getTsSourceMaps()) {
			for (const maped of sourceMap.mappings) {
				if (!maped.data.capabilities.referencesCodeLens) continue;
				const data: ReferencesCodeLensData = {
					lsType: sourceMap.lsType,
					uri: uri,
					offset: maped.sourceRange.start,
					tsUri: sourceMap.mappedDocument.uri,
					tsOffset: maped.mappedRange.start,
				};
				result.push({
					range: {
						start: document.positionAt(maped.sourceRange.start),
						end: document.positionAt(maped.sourceRange.end),
					},
					// @ts-expect-error
					data,
				});
			}
		}

		return result;
	}
}
