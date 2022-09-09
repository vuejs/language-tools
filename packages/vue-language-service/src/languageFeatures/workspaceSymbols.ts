import { transformSymbolInformations } from '@volar/transforms';
import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';

export function register(context: LanguageServiceRuntimeContext) {

	return async (query: string) => {

		const symbolsList: vscode.SymbolInformation[][] = [];

		for (const plugin of context.plugins) {

			if (!plugin.findWorkspaceSymbols)
				continue;

			const embeddedSymbols = await plugin.findWorkspaceSymbols(query);

			if (!embeddedSymbols)
				continue;

			const symbols = transformSymbolInformations(embeddedSymbols, loc => {
				for (const vueLoc of context.documents.fromEmbeddedLocation(loc.uri, loc.range.start, loc.range.end)) {
					return vscode.Location.create(vueLoc.uri, vueLoc.range);
				}
			});

			symbolsList.push(symbols);
		}

		return symbolsList.flat();
	};
}
