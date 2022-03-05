import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { visitEmbedded } from '../plugins/definePlugin';
import type { DocumentServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';

export function register(context: DocumentServiceRuntimeContext) {

	return async (document: TextDocument) => {

		const vueDocument = context.getVueDocument(document);
		const colorsList: vscode.ColorInformation[][] = [];

		if (vueDocument) {

			const embeddeds = vueDocument.getEmbeddeds();

			await visitEmbedded(embeddeds, async sourceMap => {

				if (!sourceMap.capabilities.documentSymbol) // TODO: add color capabilitie setting
					return true;

				const plugins = context.getPlugins(sourceMap.mappedDocument);

				for (const plugin of plugins) {

					if (!plugin.findDocumentColors)
						continue;

					const embeddedColors = await plugin.findDocumentColors(sourceMap.mappedDocument);

					if (!embeddedColors)
						continue;

					const colors = embeddedColors.map(color => {
						const range = sourceMap.getSourceRange(color.range.start, color.range.end)?.[0];
						if (range) {
							return vscode.ColorInformation.create(range, color.color);
						}
					}).filter(shared.notEmpty);

					colorsList.push(colors);
				}

				return true;
			});
		}

		const plugins = context.getPlugins(document);

		for (const plugin of plugins) {

			if (!plugin.findDocumentColors)
				continue;

			const colors = await plugin.findDocumentColors(document);

			if (!colors)
				continue;

			colorsList.push(colors);
		}

		return colorsList.flat();
	}
}
