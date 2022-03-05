import { transformSymbolInformations } from '@volar/transforms';
import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';

export function register(
	context: LanguageServiceRuntimeContext,
) {

	const { scriptTsLs, sourceFiles } = context;

	return (query: string) => {

		const symbols = scriptTsLs.findWorkspaceSymbols(query);
		return transformSymbolInformations(symbols, loc => {
			for (const vueLoc of sourceFiles.fromTsLocation('script', loc.uri, loc.range.start, loc.range.end)) {
				return vscode.Location.create(vueLoc.uri, vueLoc.range);
			}
		});
	}
}
