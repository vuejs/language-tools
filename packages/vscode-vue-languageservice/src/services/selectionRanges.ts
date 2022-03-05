import * as shared from '@volar/shared';
import { transformSelectionRanges } from '@volar/transforms';
import type * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { DocumentServiceRuntimeContext } from '../types';
import { visitEmbedded } from '../plugins/definePlugin';

export function register(context: DocumentServiceRuntimeContext) {

	return async (document: TextDocument, positions: vscode.Position[]) => {

		const vueDocument = context.getVueDocument(document);
		const rangesList: vscode.SelectionRange[][] = [];

		if (vueDocument) {

			const embeddeds = vueDocument.getEmbeddeds();

			await visitEmbedded(embeddeds, async sourceMap => {

				const embeddedPositions = positions
					.map(position => sourceMap.getMappedRange(position, position, data => !!data.capabilities.basic)?.[0].start)
					.filter(shared.notEmpty);
				const plugins = context.getPlugins(sourceMap.mappedDocument);

				for (const plugin of plugins) {

					if (!plugin.getSelectionRanges)
						continue;

					const embeddedRanges = await plugin.getSelectionRanges(sourceMap.mappedDocument, embeddedPositions);

					if (!embeddedRanges)
						continue;

					const ranges = transformSelectionRanges(
						embeddedRanges,
						range => sourceMap.getSourceRange(range.start, range.end)?.[0],
					);

					rangesList.push(ranges);
				}

				return true;
			});
		}

		const plugins = context.getPlugins(document);

		for (const plugin of plugins) {

			if (!plugin.getSelectionRanges)
				continue;

			const ranges = await plugin.getSelectionRanges(document, positions);

			if (!ranges)
				continue;

			rangesList.push(ranges);
		}

		return rangesList.flat();
	}
}
