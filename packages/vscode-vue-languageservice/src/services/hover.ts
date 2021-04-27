import type { Hover, LocationLink, Position } from 'vscode-languageserver/node';
import { MarkupContent } from 'vscode-languageserver/node';
import type { TsApiRegisterOptions } from '../types';
import { register as registerFindDefinitions } from './definition';

export function register({ mapper }: TsApiRegisterOptions) {

	const findDefinitions = registerFindDefinitions(arguments[0]);

	return (uri: string, position: Position) => {

		const tsResult = onTs(uri, position);
		const htmlResult = onHtml(uri, position);
		const cssResult = onCss(uri, position);

		if (!tsResult && !htmlResult && !cssResult) return;

		const texts = [
			...getHoverTexts(tsResult),
			...getHoverTexts(htmlResult),
			...getHoverTexts(cssResult),
		];
		const result: Hover = {
			contents: texts,
			range: cssResult?.range ?? htmlResult?.range ?? tsResult?.range,
		};

		return result;
	}

	function onTs(uri: string, position: Position, isExtra = false) {

		let result: Hover | undefined;

		// vue -> ts
		for (const tsRange of mapper.ts.to(uri, position)) {

			if (!tsRange.data.capabilities.basic) continue;

			const tsHover = tsRange.languageService.doHover(
				tsRange.textDocument.uri,
				tsRange.range.start,
				isExtra,
			);
			if (!tsHover) continue;

			if (!isExtra && tsRange.data.capabilities.extraHoverInfo) {
				const definitions = findDefinitions.on(uri, position) as LocationLink[];
				for (const definition of definitions) {
					const extraHover = onTs(definition.targetUri, definition.targetSelectionRange.start, true);
					if (!extraHover) continue;
					if (!MarkupContent.is(extraHover.contents)) continue;
					const extraText = extraHover.contents.value;
					for (const extraTextPart of extraText.split('\n\n')) {
						if (MarkupContent.is(tsHover.contents) && !tsHover.contents.value.split('\n\n').includes(extraTextPart)) {
							tsHover.contents.value += `\n\n` + extraTextPart;
						}
					}
				}
			}

			if (tsHover.range) {
				// ts -> vue
				for (const vueRange of mapper.ts.from(tsRange.textDocument.uri, tsHover.range.start, tsHover.range.end)) {
					result = {
						...tsHover,
						range: vueRange.range,
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
					htmlRange.range.start,
					htmlRange.htmlDocument,
				)
				: htmlRange.languageService.doHover(
					htmlRange.pugDocument,
					htmlRange.range.start,
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
					range: vueRange.range,
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
			for (const vueRange of mapper.css.from(cssMaped.textDocument.uri, cssHover.range.start, cssHover.range.end)) {
				result = {
					...cssHover,
					range: vueRange.range,
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
