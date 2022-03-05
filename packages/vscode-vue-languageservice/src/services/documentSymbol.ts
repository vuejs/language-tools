import { transformSymbolInformations } from '@volar/transforms';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { DocumentServiceRuntimeContext } from '../types';
import { visitEmbedded } from '../plugins/definePlugin';

export function register(context: DocumentServiceRuntimeContext) {

	return async (document: TextDocument) => {

		const vueDocument = context.getVueDocument(document);
		const symbolsList: vscode.SymbolInformation[][] = [];

		if (vueDocument) {

			const embeddeds = vueDocument.getEmbeddeds();

			await visitEmbedded(embeddeds, async sourceMap => {

				if (!sourceMap.capabilities.documentSymbol)
					return true;

				const plugins = context.getPlugins(sourceMap.mappedDocument);

				for (const plugin of plugins) {

					if (!plugin.findDocumentSymbols)
						continue;

					const embeddedSymbols = await plugin.findDocumentSymbols(sourceMap.mappedDocument);

					if (!embeddedSymbols)
						continue;

					const symbols = transformSymbolInformations(
						embeddedSymbols,
						location => {
							const sourceRange = sourceMap.getSourceRange(location.range.start, location.range.end)?.[0];
							if (sourceRange) {
								return vscode.Location.create(sourceMap.sourceDocument.uri, sourceRange);
							}
						},
					);

					symbolsList.push(symbols);
				}

				return true;
			});
		}

		const plugins = context.getPlugins(document);

		for (const plugin of plugins) {

			if (!plugin.findDocumentSymbols)
				continue;

			const symbols = await plugin.findDocumentSymbols(document);

			if (!symbols)
				continue;

			symbolsList.push(symbols);
		}

		return symbolsList.flat();
	}
}
