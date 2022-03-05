import type { DocumentServiceRuntimeContext } from '../types';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { visitEmbedded } from '../plugins/definePlugin';
import * as shared from '@volar/shared';

export function register(context: DocumentServiceRuntimeContext) {

	return async (document: TextDocument, position: vscode.Position) => {

		const vueDocument = context.getVueDocument(document);
		let linkedRanges: vscode.LinkedEditingRanges | undefined;

		if (vueDocument) {

			const embeddeds = vueDocument.getEmbeddeds();

			await visitEmbedded(embeddeds, async sourceMap => {

				const plugins = context.getPlugins(sourceMap.mappedDocument);

				for (const [mapedRange] of sourceMap.getMappedRanges(
					position,
					position,
					data => !!data.capabilities.completion,
				)) {

					for (const plugin of plugins) {

						if (!plugin.findLinkedEditingRanges)
							continue;

						const embeddedLinkedRanges = await plugin.findLinkedEditingRanges(sourceMap.mappedDocument, mapedRange.start);

						if (!embeddedLinkedRanges)
							continue;

						linkedRanges = {
							wordPattern: embeddedLinkedRanges.wordPattern,
							ranges: embeddedLinkedRanges.ranges.map(range => sourceMap.getSourceRange(range.start, range.end)?.[0]).filter(shared.notEmpty),
						};

						return false;
					}
				}

				return true;
			});
		}

		if (!linkedRanges) {

			const plugins = context.getPlugins(document);

			for (const plugin of plugins) {

				if (!plugin.findLinkedEditingRanges)
					continue;

				const _ranges = await plugin.findLinkedEditingRanges(document, position);

				if (!_ranges)
					continue;

				linkedRanges = _ranges;
			}
		}

		return linkedRanges;
	}
}
