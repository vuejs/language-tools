import type * as vscode from 'vscode-languageserver';
import type { ApiLanguageServiceContext } from '../types';
import * as shared from '@volar/shared';
import type { SourceFile } from '..';

export function register({ sourceFiles, getTsLs }: ApiLanguageServiceContext) {
	return async (uri: string, range: vscode.Range) => {

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) return;

		const document = sourceFile.getTextDocument();
		const offsetRange = {
			start: document.offsetAt(range.start),
			end: document.offsetAt(range.end),
		};

		const tsResult = await getTsResult(sourceFile);
		if (tsResult) return tsResult;

		async function getTsResult(sourceFile: SourceFile) {

			const result: shared.InlayHint[] = [];

			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const mapping of sourceMap) {

					if (!mapping.data.capabilities.completion)
						continue;

					if (mapping.sourceRange.start > offsetRange.end || mapping.sourceRange.end < offsetRange.start)
						continue;

					const offset = mapping.mappedRange.start - mapping.sourceRange.start;
					const start = Math.max(mapping.sourceRange.start, offsetRange.start) + offset;
					const end = Math.min(mapping.sourceRange.end, offsetRange.end) + offset;
					const tsHints = await getTsLs(sourceMap.lsType).getInlayHints(sourceMap.mappedDocument.uri, {
						start: sourceMap.mappedDocument.positionAt(start),
						end: sourceMap.mappedDocument.positionAt(end),
					});

					if (tsHints) {
						for (const tsHint of tsHints) {
							const vueLoc = sourceMap.getSourceRange(tsHint.position);
							if (vueLoc) {
								result.push({
									...tsHint,
									position: vueLoc.start,
								});
							}
						}
					}
				}
			}

			return result;
		}
	}
}
