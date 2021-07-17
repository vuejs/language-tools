import type { Position, SignatureHelpContext } from 'vscode-languageserver/node';
import type { ApiLanguageServiceContext } from '../types';

export function register({ sourceFiles, getTsLs }: ApiLanguageServiceContext) {
	return (uri: string, position: Position, context?: SignatureHelpContext) => {

		const tsResult = getTsResult();
		if (tsResult) return tsResult;

		function getTsResult() {
			for (const tsLoc of sourceFiles.toTsLocations(uri, position)) {
				if (tsLoc.type === 'embedded-ts' && !tsLoc.range.data.capabilities.basic)
					continue;
				const result = getTsLs(tsLoc.lsType).getSignatureHelp(tsLoc.uri, tsLoc.range.start, context);
				if (result) {
					return result;
				}
			}
		}
	}
}
