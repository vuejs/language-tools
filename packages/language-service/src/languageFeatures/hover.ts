import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';
import { languageFeatureWorker } from '../utils/featureWorkers';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string, position: vscode.Position) => {

		return languageFeatureWorker(
			context,
			uri,
			position,
			(position, sourceMap) => sourceMap.toGeneratedPositions(position, data => !!data.hover),
			(plugin, document, position) => plugin.doHover?.(document, position),
			(item, sourceMap) => {

				if (!sourceMap || !item.range)
					return item;

				const range = sourceMap.toSourceRange(item.range);
				if (range) {
					item.range = range;
					return item;
				}
			},
			hovers => ({
				contents: hovers.map(getHoverTexts).flat(),
				range: hovers.find(hover => hover.range && shared.isInsideRange(hover.range, { start: position, end: position }))?.range ?? hovers[0].range,
			}),
		);
	};
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
