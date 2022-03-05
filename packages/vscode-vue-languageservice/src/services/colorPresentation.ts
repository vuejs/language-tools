import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { visitEmbedded } from '../plugins/definePlugin';
import type { DocumentServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';

export function register(context: DocumentServiceRuntimeContext) {

	return async (document: TextDocument, color: vscode.Color, range: vscode.Range) => {

		const vueDocument = context.getVueDocument(document);
		let colorPresentations: vscode.ColorPresentation[] | undefined;

		if (vueDocument) {

			const embeddeds = vueDocument.getEmbeddeds();

			await visitEmbedded(embeddeds, async sourceMap => {

				if (!sourceMap.capabilities.documentSymbol) // TODO: add color capabilitie setting
					return true;

				const plugins = context.getPlugins(sourceMap.mappedDocument);

				for (const [mapedRange] of sourceMap.getMappedRanges(
					range.start,
					range.end,
					data => !!data.capabilities.completion,
				)) {

					for (const plugin of plugins) {

						if (!plugin.getColorPresentations)
							continue;

						const _colorPresentations = await plugin.getColorPresentations(sourceMap.mappedDocument, color, mapedRange);

						if (!_colorPresentations)
							continue;

						colorPresentations = _colorPresentations.map(cp => {
							if (cp.textEdit) {

								const editRange = sourceMap.getSourceRange(cp.textEdit.range.start, cp.textEdit.range.end)?.[0];

								if (!editRange)
									return undefined;

								cp.textEdit.range = editRange;
							}
							if (cp.additionalTextEdits) {
								for (const textEdit of cp.additionalTextEdits) {

									const editRange = sourceMap.getSourceRange(textEdit.range.start, textEdit.range.end)?.[0];

									if (!editRange)
										return undefined;

									textEdit.range = editRange;
								}
							}
							return cp;
						}).filter(shared.notEmpty);

						return false;
					}
				}

				return true;
			});
		}

		if (!colorPresentations) {

			const plugins = context.getPlugins(document);

			for (const plugin of plugins) {

				if (!plugin.getColorPresentations)
					continue;

				const _colorPresentations = await plugin.getColorPresentations(document, color, range);

				if (!_colorPresentations)
					continue;

				colorPresentations = _colorPresentations;
			}
		}

		return colorPresentations;
	}
}
