import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';
import { Embedded, EmbeddedDocumentSourceMap } from '@volar/vue-typescript';

export function register({ sourceFiles, getTsLs, plugins, getTextDocument, pluginHost }: LanguageServiceRuntimeContext) {

	return async (uri: string, position: vscode.Position) => {

		const vueDocument = sourceFiles.get(uri);
		const hovers: vscode.Hover[] = [];

		if (vueDocument) {

			const embeddeds = vueDocument.getEmbeddeds();

			await visitEmbedded(embeddeds, async sourceMap => {

				pluginHost.tsLs = sourceMap.lsType ? getTsLs(sourceMap.lsType) : undefined;

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

				return true;
			});

			async function visitEmbedded(embeddeds: Embedded[], cb: (sourceMap: EmbeddedDocumentSourceMap) => Promise<boolean>) {
				for (const embedded of embeddeds) {

					await visitEmbedded(embedded.embeddeds, cb);

					if (embedded.sourceMap) {
						await cb(embedded.sourceMap);
					}
				}
			}
		}
		else {

			const document = getTextDocument(uri);

			if (document) {

				pluginHost.tsLs = getTsLs('script');

				for (const plugin of plugins) {
					if (plugin.onHover) {
						const hover = await plugin.onHover(document, position);
						if (hover) {
							hovers.push(hover);
						}
					}
				}
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
