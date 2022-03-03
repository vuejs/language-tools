import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';
import { Embedded, EmbeddedDocumentSourceMap } from '@volar/vue-typescript';

export function register({ sourceFiles, htmlLs, pugLs, getCssLs, getTsLs, vueHost, getStylesheet, getHtmlDocument, getPugDocument, plugins, getTextDocument, pluginHost }: LanguageServiceRuntimeContext) {

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

					visitEmbedded(embedded.embeddeds, cb);

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

	// function onTs(uri: string, position: vscode.Position) {

	// 	let result: vscode.Hover | undefined;

	// 	// vue -> ts
	// 	for (const tsLoc of sourceFiles.toTsLocations(
	// 		uri,
	// 		position,
	// 		position,
	// 		data => !!data.capabilities.basic
	// 	)) {

	// 		if (tsLoc.type === 'source-ts' && tsLoc.lsType !== 'script')
	// 			continue;

	// 		const tsLs = getTsLs(tsLoc.lsType);
	// 		const tsHover = tsLs.doHover(
	// 			tsLoc.uri,
	// 			tsLoc.range.start,
	// 		);
	// 		if (!tsHover) continue;

	// 		if (tsHover.range) {
	// 			// ts -> vue
	// 			const hoverRange = { start: position, end: position };
	// 			for (const vueLoc of sourceFiles.fromTsLocation(tsLoc.lsType, tsLoc.uri, tsHover.range.start, tsHover.range.end)) {
	// 				result = {
	// 					...tsHover,
	// 					range: vueLoc.range,
	// 				};
	// 				if (shared.isInsideRange(vueLoc.range, hoverRange))
	// 					break;
	// 			}
	// 		}
	// 		else {
	// 			result = tsHover;
	// 		}
	// 	}

	// 	return result;
	// }
	async function onHtml(uri: string, position: vscode.Position) {

		let result: vscode.Hover | undefined;

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile)
			return result;

		// vue -> html
		for (const sourceMap of sourceFile.getTemplateSourceMaps()) {

			const htmlDocument = getHtmlDocument(sourceMap.mappedDocument);
			const pugDocument = getPugDocument(sourceMap.mappedDocument);

			const settings = await vueHost.getHtmlHoverSettings?.(sourceMap.mappedDocument);
			for (const [htmlRange] of sourceMap.getMappedRanges(position)) {

				const htmlHover = htmlDocument ? htmlLs.doHover(
					sourceMap.mappedDocument,
					htmlRange.start,
					htmlDocument,
					settings,
				) : pugDocument ? pugLs.doHover(
					pugDocument,
					htmlRange.start,
				) : undefined;

				if (!htmlHover)
					continue;
				if (!htmlHover.range) {
					result = htmlHover;
					continue;
				}
				// html -> vue
				for (const [vueRange] of sourceMap.getSourceRanges(htmlHover.range.start, htmlHover.range.end)) {
					result = {
						...htmlHover,
						range: vueRange,
					};
				}
			}
		}

		return result;
	}
	async function onCss(uri: string, position: vscode.Position) {

		let result: vscode.Hover | undefined;

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile)
			return result;

		// vue -> css
		for (const sourceMap of sourceFile.getCssSourceMaps()) {

			const stylesheet = getStylesheet(sourceMap.mappedDocument);
			const cssLs = getCssLs(sourceMap.mappedDocument.languageId);

			if (!cssLs || !stylesheet)
				continue;

			for (const [cssRange] of sourceMap.getMappedRanges(position)) {
				const settings = await vueHost.getCssLanguageSettings?.(sourceMap.mappedDocument);
				const cssHover = cssLs.doHover(
					sourceMap.mappedDocument,
					cssRange.start,
					stylesheet,
					settings?.hover,
				);
				if (!cssHover)
					continue;
				if (!cssHover.range) {
					result = cssHover;
					continue;
				}
				// css -> vue
				for (const [vueRange] of sourceMap.getSourceRanges(cssHover.range.start, cssHover.range.end)) {
					result = {
						...cssHover,
						range: vueRange,
					};
				}
			}
		}

		return result;
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
