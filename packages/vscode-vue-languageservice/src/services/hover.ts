import type { TsApiRegisterOptions } from '../types';
import type { Position } from 'vscode-languageserver/node';
import type { Hover } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { MarkupContent } from 'vscode-languageserver/node';

export function register({ mapper }: TsApiRegisterOptions) {

	return (document: TextDocument, position: Position) => {

		const tsResult = onTs(document.uri, position);
		const htmlResult = onHtml(document.uri, position);
		const cssResult = onCss(document.uri, position);

		if (!tsResult && !htmlResult && !cssResult) return;

		const texts = [
			...getHoverTexts(tsResult),
			...getHoverTexts(htmlResult),
			...getHoverTexts(cssResult),
		];
		const result: Hover = {
			contents: texts,
			range: tsResult?.range ?? htmlResult?.range ?? cssResult?.range,
		};

		return result;
	}

	function onTs(uri: string, position: Position) {

		let result: Hover | undefined;

		// vue -> ts
		for (const tsRange of mapper.ts.to(uri, position)) {
			if (!tsRange.data.capabilities.basic)
				continue;
			const tsHover = tsRange.languageService.doHover(
				tsRange.textDocument.uri,
				tsRange.start,
			);
			if (!tsHover)
				continue;
			if (!tsHover.range) {
				result = tsHover;
				continue;
			}
			// ts -> vue
			for (const vueRange of mapper.ts.from(tsRange.textDocument.uri, tsHover.range.start, tsHover.range.end)) {
				result = {
					...tsHover,
					range: vueRange,
				};
			}
		}

		return result;
	}
	function onHtml(uri: string, position: Position) {

		let result: Hover | undefined;

		// vue -> html
		for (const htmlRange of mapper.html.to(uri, position)) {
			const htmlHover = htmlRange.language === 'html'
				? htmlRange.languageService.doHover(
					htmlRange.textDocument,
					htmlRange.start,
					htmlRange.htmlDocument,
				)
				: htmlRange.languageService.doHover(
					htmlRange.pugDocument,
					htmlRange.start,
				)
			if (!htmlHover)
				continue;
			if (!htmlHover.range) {
				result = htmlHover;
				continue;
			}
			// html -> vue
			for (const vueRange of mapper.html.from(htmlRange.textDocument.uri, htmlHover.range.start, htmlHover.range.end)) {
				result = {
					...htmlHover,
					range: vueRange,
				};
			}
		}

		return result;
	}
	function onCss(uri: string, position: Position) {

		let result: Hover | undefined;

		// vue -> css
		for (const cssMaped of mapper.css.to(uri, position)) {
			const cssHover = cssMaped.languageService.doHover(
				cssMaped.textDocument,
				cssMaped.start,
				cssMaped.stylesheet,
			);
			if (!cssHover)
				continue;
			if (!cssHover.range) {
				result = cssHover;
				continue;
			}
			// css -> vue
			for (const vueRange of mapper.css.from(cssMaped.textDocument.uri, cssHover.range.start, cssHover.range.end)) {
				result = {
					...cssHover,
					range: vueRange,
				};
			}
		}

		return result;
	}
}

function getHoverTexts(hover?: Hover) {
	if (!hover) {
		return [];
	}
	if (typeof hover.contents === 'string') {
		return [hover.contents];
	}
	if (MarkupContent.is(hover.contents)) {
		return [hover.contents.value];
	}
	if (Array.isArray(hover.contents)) {
		return hover.contents;
	}
	return [hover.contents.value];
}
