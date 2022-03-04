import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';
import { visitEmbedded } from '../plugins/definePlugin';

export function register({ sourceFiles, getPlugins, getTextDocument }: LanguageServiceRuntimeContext) {

	return async (uri: string, position: vscode.Position) => {

		const vueDocument = sourceFiles.get(uri);
		const document = getTextDocument(uri)
		const hovers: vscode.Hover[] = [];

		if (vueDocument) {

			const embeddeds = vueDocument.getEmbeddeds();

			await visitEmbedded(embeddeds, async sourceMap => {

				const plugins = getPlugins(sourceMap);

				for (const [embeddedRange] of sourceMap.getMappedRanges(position, position, data => !!data.capabilities.basic)) {

					for (const plugin of plugins) {

						if (!plugin.onHover)
							continue;

						const embeddedHover = await plugin.onHover(sourceMap.mappedDocument, embeddedRange.start);

						if (!embeddedHover)
							continue;

						if (embeddedHover.range) {
							for (const [vueRange] of sourceMap.getSourceRanges(embeddedHover.range.start, embeddedHover.range.end)) {
								hovers.push({
									contents: embeddedHover.contents,
									range: vueRange,
								});
								break;
							}
						}
						else {
							hovers.push(embeddedHover);
						}
					}
				}
			});
		}

		if (document) {

			const plugins = getPlugins();

			for (const plugin of plugins) {

				if (!plugin.onHover)
					continue;

				const hover = await plugin.onHover(document, position);

				if (!hover)
					continue;

				hovers.push(hover);
			}
		}

		if (hovers.length > 1) {
			return {
				contents: hovers.map(getHoverTexts).flat(),
				range: hovers.find(hover => hover.range && shared.isInsideRange(hover.range, { start: position, end: position }))?.range ?? hovers[0].range,
			};
		}
		else if (hovers.length === 1) {
			return hovers[0];
		}
	}
}

function getHoverTexts(hover?: vscode.Hover) {
	if (!hover) {
		return [];
	}
	if (typeof hover.contents === 'string') {
		return [hover.contents];
	}
	if (vscode.MarkupContent.is(hover.contents)) {
		return [hover.contents.value];
	}
	if (Array.isArray(hover.contents)) {
		return hover.contents;
	}
	return [hover.contents.value];
}
