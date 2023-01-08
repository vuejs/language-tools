import * as transformer from '../transformer';
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

			const symbols = transformer.asSymbolInformations(embeddedSymbols, loc => {
				if (context.documents.hasVirtualFileByUri(loc.uri)) {
					for (const [_, map] of context.documents.getMapsByVirtualFileUri(loc.uri)) {
						const range = map.toSourceRange(loc.range);
						if (range) {
							return vscode.Location.create(map.sourceFileDocument.uri, range);
						}
					}
				}
				else {
					return loc;
				}
			});

			symbolsList.push(symbols);
		}

		return symbolsList.flat();
	};
}
