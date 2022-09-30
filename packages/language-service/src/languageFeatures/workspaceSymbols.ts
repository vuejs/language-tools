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
				const sourceMap = context.documents.sourceMapFromEmbeddedDocumentUri(loc.uri);
				if (sourceMap) {
					const range = sourceMap.toSourceRange(loc.range);
					if (range) {
						return vscode.Location.create(sourceMap.sourceDocument.uri, range);
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
