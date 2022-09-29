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
			function* (position, sourceMap) {
				for (const mapped of sourceMap.toGeneratedPositions(position)) {
					if (mapped[1].data.hover) {
						yield mapped[0];
					}
				}
			},
			(plugin, document, position) => plugin.doHover?.(document, position),
			(data, sourceMap) => {

				if (!sourceMap)
					return data;

				if (!data.range)
					return data;

				const start = sourceMap.toSourcePosition(data.range.start)?.[0];
				const end = sourceMap.toSourcePosition(data.range.end)?.[0];

				if (start && end) {
					data.range = { start, end };
					return data;
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
