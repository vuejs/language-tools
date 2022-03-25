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
				for (const [mappedRange] of sourceMap.getMappedRanges(
					position,
					position,
					data => !!data.capabilities.basic,
				)) {
					yield mappedRange.start;
				}
			},
			(plugin, document, position) => plugin.findDocumentHighlights?.(document, position),
			(data, sourceMap) => data.map(highlisht => {

				if (!sourceMap)
					return highlisht;

				const range = sourceMap.getSourceRange(highlisht.range.start, highlisht.range.end)?.[0];

				if (range) {
					return {
						...highlisht,
						range,
					};
				}
			}).filter(shared.notEmpty),
			arr => arr.flat(),
		);
	}
}
