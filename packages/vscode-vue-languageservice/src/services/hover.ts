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
		for (const tsMaped of mapper.ts.to(uri, { start: position, end: position })) {
			if (!tsMaped.data.capabilities.basic)
				continue;
			const tsHover = tsMaped.languageService.doHover(
				tsMaped.textDocument.uri,
				tsMaped.range.start,
			);
			if (!tsHover)
				continue;
			if (!tsHover.range) {
				result = tsHover;
				continue;
			}
			// ts -> vue
			for (const vueMaped of mapper.ts.from(tsMaped.textDocument.uri, tsHover.range)) {
				result = {
					...tsHover,
					range: vueMaped.range,
				};
			}
		}

		return result;
	}
	function onHtml(uri: string, position: Position) {

		let result: Hover | undefined;

		// vue -> html
		for (const htmlMaped of mapper.html.to(uri, { start: position, end: position })) {
			const htmlHover = htmlMaped.language === 'html'
				? htmlMaped.languageService.doHover(
					htmlMaped.textDocument,
					htmlMaped.range.start,
					htmlMaped.htmlDocument,
				)
				: htmlMaped.languageService.doHover(
					htmlMaped.pugDocument,
					htmlMaped.range.start,
				)
			if (!htmlHover)
				continue;
			if (!htmlHover.range) {
				result = htmlHover;
				continue;
			}
			// html -> vue
			for (const vueMaped of mapper.html.from(htmlMaped.textDocument.uri, htmlHover.range)) {
				result = {
					...htmlHover,
					range: vueMaped.range,
				};
			}
		}

		return result;
	}
	function onCss(uri: string, position: Position) {

		let result: Hover | undefined;

		// vue -> css
		for (const cssMaped of mapper.css.to(uri, { start: position, end: position })) {
			const cssHover = cssMaped.languageService.doHover(
				cssMaped.textDocument,
				cssMaped.range.start,
				cssMaped.stylesheet,
			);
			if (!cssHover)
				continue;
			if (!cssHover.range) {
				result = cssHover;
				continue;
			}
			// css -> vue
			for (const vueMaped of mapper.css.from(cssMaped.textDocument.uri, cssHover.range)) {
				result = {
					...cssHover,
					range: vueMaped.range,
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
