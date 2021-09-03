import type * as vscode from 'vscode-languageserver';
import type { ApiLanguageServiceContext } from '../types';
import * as shared from '@volar/shared';

export function register({ sourceFiles, getTsLs }: ApiLanguageServiceContext) {
	return async (uri: string, range: vscode.Range) => {

		const tsResult = await getTsResult();
		if (tsResult) return tsResult;

		async function getTsResult() {
			for (const tsLoc of sourceFiles.toTsLocations(uri, range.start, range.end)) {

				if (tsLoc.type === 'embedded-ts' && !tsLoc.range.data.capabilities.completion)
					continue;

				const result = await getTsLs(tsLoc.lsType).getInlayHints(tsLoc.uri, tsLoc.range);
				if (result) {
					return result.map(hint => {
						for (const vueLoc of sourceFiles.fromTsLocation(tsLoc.lsType, tsLoc.uri, hint.position)) {
							return {
								...hint,
								position: vueLoc.range.start,
							};
						}
					}).filter(shared.notEmpty);
				}
			}
		}
	}
}
