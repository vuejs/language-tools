import * as vscode from 'vscode-languageserver';
import type { ApiLanguageServiceContext } from '../types';
import { HtmlSourceMap } from '../utils/sourceMaps';
import { register as registerFindDefinitions } from './definition';
import * as shared from '@volar/shared';

export function register({ sourceFiles, htmlLs, pugLs, getCssLs, getTsLs, vueHost }: ApiLanguageServiceContext) {

	const findDefinitions = registerFindDefinitions(arguments[0]);

	return async (uri: string, position: vscode.Position) => {

		const tsResult = onTs(uri, position);
		const htmlResult = await onHtml(uri, position);
		const cssResult = await onCss(uri, position);

		if (!tsResult && !htmlResult && !cssResult) return;

		const texts = [
			...getHoverTexts(tsResult),
			...getHoverTexts(htmlResult),
			...getHoverTexts(cssResult),
		];
		const result: vscode.Hover = {
			contents: texts,
			range: cssResult?.range ?? htmlResult?.range ?? tsResult?.range,
		};

		return result;
	}

	function onTs(uri: string, position: vscode.Position, isExtra = false) {

		let result: vscode.Hover | undefined;

		// vue -> ts
		for (const tsLoc of sourceFiles.toTsLocations(uri, position)) {

			if (tsLoc.type === 'embedded-ts' && !tsLoc.range.data.capabilities.basic)
				continue;

			if (tsLoc.type === 'source-ts' && tsLoc.lsType !== 'script')
				continue;

			const tsLs = getTsLs(tsLoc.lsType);
			const tsHover = tsLs.doHover(
				tsLoc.uri,
				tsLoc.range.start,
				isExtra,
			);
			if (!tsHover) continue;

			if (!isExtra && tsLoc.type === 'embedded-ts' && tsLoc.range.data.capabilities.extraHoverInfo) {
				const definitions = findDefinitions.on(uri, position) as vscode.LocationLink[];
				for (const definition of definitions) {
					const extraHover = onTs(definition.targetUri, definition.targetSelectionRange.start, true);
					if (!extraHover) continue;
					if (!vscode.MarkupContent.is(extraHover.contents)) continue;
					const extraText = extraHover.contents.value;
					for (const extraTextPart of extraText.split('\n\n')) {
						if (vscode.MarkupContent.is(tsHover.contents) && !tsHover.contents.value.split('\n\n').includes(extraTextPart)) {
							tsHover.contents.value += `\n\n` + extraTextPart;
						}
					}
				}
			}

			if (tsHover.range) {
				// ts -> vue
				const hoverRange = { start: position, end: position };
				for (const vueLoc of sourceFiles.fromTsLocation(tsLoc.lsType, tsLoc.uri, tsHover.range.start, tsHover.range.end)) {
					result = {
						...tsHover,
						range: vueLoc.range,
					};
					if (shared.isInsideRange(vueLoc.range, hoverRange))
						break;
				}
			}
			else {
				result = tsHover;
			}
		}

		return result;
	}
	async function onHtml(uri: string, position: vscode.Position) {

		let result: vscode.Hover | undefined;

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile)
			return result;

		// vue -> html
		for (const sourceMap of [
			...sourceFile.getHtmlSourceMaps(),
			...sourceFile.getPugSourceMaps(),
		]) {
			const settings = await vueHost.getHtmlHoverSettings?.(sourceMap.mappedDocument);
			for (const htmlRange of sourceMap.getMappedRanges(position)) {
				const htmlHover = sourceMap instanceof HtmlSourceMap
					? htmlLs.doHover(
						sourceMap.mappedDocument,
						htmlRange.start,
						sourceMap.htmlDocument,
						settings
					)
					: pugLs.doHover(
						sourceMap.pugDocument,
						htmlRange.start,
					)
				if (!htmlHover)
					continue;
				if (!htmlHover.range) {
					result = htmlHover;
					continue;
				}
				// html -> vue
				for (const vueRange of sourceMap.getSourceRanges(htmlHover.range.start, htmlHover.range.end)) {
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

			if (!sourceMap.stylesheet)
				continue;

			const cssLs = getCssLs(sourceMap.mappedDocument.languageId);
			if (!cssLs)
				continue;

			for (const cssRange of sourceMap.getMappedRanges(position)) {
				const settings = await vueHost.getCssLanguageSettings?.(sourceMap.mappedDocument);
				const cssHover = cssLs.doHover(
					sourceMap.mappedDocument,
					cssRange.start,
					sourceMap.stylesheet,
					settings?.hover,
				);
				if (!cssHover)
					continue;
				if (!cssHover.range) {
					result = cssHover;
					continue;
				}
				// css -> vue
				for (const vueRange of sourceMap.getSourceRanges(cssHover.range.start, cssHover.range.end)) {
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
