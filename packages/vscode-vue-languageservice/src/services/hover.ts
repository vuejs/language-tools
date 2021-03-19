import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Hover, LocationLink, Position } from 'vscode-languageserver/node';
import { MarkupContent } from 'vscode-languageserver/node';
import type { TsApiRegisterOptions } from '../types';
import { register as registerFindDefinitions } from './definitions';

export function register({ mapper }: TsApiRegisterOptions) {

	const findDefinitions = registerFindDefinitions(arguments[0]);

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

	function onTs(uri: string, position: Position, withExtra = true) {

		let result: Hover | undefined;

		// vue -> ts
		for (const tsRange of mapper.ts.to(uri, position)) {

			if (!tsRange.data.capabilities.basic) continue;

			const tsHover = tsRange.languageService.doHover(
				tsRange.textDocument.uri,
				tsRange.start,
			);
			if (!tsHover) continue;

			if (withExtra && tsRange.data.capabilities.extraHoverInfo) {
				const definitions = findDefinitions.on(uri, position) as LocationLink[];
				for (const definition of definitions) {
					const extraHover = onTs(definition.targetUri, definition.targetSelectionRange.start, false);
					if (!extraHover) continue;
					if (!MarkupContent.is(extraHover.contents)) continue;
					let extraText = extraHover.contents.value;
					const splitIndex = extraText.lastIndexOf('```');
					if (splitIndex >= 0) {
						extraText = extraText.substr(splitIndex + 3).trim();
					}
					if (extraText && MarkupContent.is(tsHover.contents) && !tsHover.contents.value.split('\n\n').includes(extraText)) {
						tsHover.contents.value += `\n\n` + extraText;
					}
				}
			}

			if (tsHover.range) {
				// ts -> vue
				for (const vueRange of mapper.ts.from(tsRange.textDocument.uri, tsHover.range.start, tsHover.range.end)) {
					result = {
						...tsHover,
						range: vueRange,
					};
				}
			}
			else {
				result = tsHover;
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
