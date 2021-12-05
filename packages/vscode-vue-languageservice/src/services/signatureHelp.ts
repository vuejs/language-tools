import type * as vscode from 'vscode-languageserver';
import type { ApiLanguageServiceContext } from '../types';

export function register({ sourceFiles, getTsLs }: ApiLanguageServiceContext) {
	return (uri: string, position: vscode.Position, context?: vscode.SignatureHelpContext) => {

		const tsResult = getTsResult();
		if (tsResult) return tsResult;

		function getTsResult() {
			for (const tsLoc of sourceFiles.toTsLocations(
				uri,
				position,
				position,
				data => !!data.capabilities.basic,
			)) {

				if (tsLoc.type === 'source-ts' && tsLoc.lsType !== 'script')
					continue;

				const result = getTsLs(tsLoc.lsType).getSignatureHelp(tsLoc.uri, tsLoc.range.start, context);
				if (result) {
					return result;
				}
			}
		}
	}
}
