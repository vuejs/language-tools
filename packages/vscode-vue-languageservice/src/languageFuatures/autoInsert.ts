import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';
import { EmbeddedLanguagePlugin } from '../plugins/definePlugin';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string, position: vscode.Position, options: Parameters<NonNullable<EmbeddedLanguagePlugin['doAutoInsert']>>[2]) => {

		return languageFeatureWorker(
			context,
			uri,
			position,
			function* (position, sourceMap) {
				for (const [mapedRange] of sourceMap.getMappedRanges(
					position,
					position,
					data => !!data.capabilities.completion,
				)) {
					yield mapedRange.start;
				}
			},
			(plugin, document, position) => plugin.doAutoInsert?.(document, position, options),
			(data, sourceMap) => {

				if (typeof data === 'string')
					return data;

				const range = sourceMap.getSourceRange(data.range.start, data.range.end)?.[0];

				if (range) {
					data.range = range;
					return data;
				}
			},
		);
	}
}
