import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';
import { EmbeddedLanguageServicePlugin } from '@volar/vue-language-service-types';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string, position: vscode.Position, autoInsertContext: Parameters<NonNullable<EmbeddedLanguageServicePlugin['doAutoInsert']>>[2]) => {

		return languageFeatureWorker(
			context,
			uri,
			{ position, autoInsertContext },
			function* (arg, sourceMap) {

				const position = sourceMap.getMappedRange(arg.position, arg.position, data => !!data.capabilities.completion)?.[0].start;
				const rangeOffset = sourceMap.getMappedRange(arg.autoInsertContext.lastChange.rangeOffset, arg.autoInsertContext.lastChange.rangeOffset, data => !!data.capabilities.completion)?.[0].start;
				const range = sourceMap.getMappedRange(arg.autoInsertContext.lastChange.range.start, arg.autoInsertContext.lastChange.range.end, data => !!data.capabilities.completion)?.[0];

				if (position && rangeOffset !== undefined && range) {
					yield {
						position,
						autoInsertContext: {
							lastChange: {
								...arg.autoInsertContext.lastChange,
								rangeOffset,
								range,
							},
						},
					};
				}
			},
			(plugin, document, arg) => plugin.doAutoInsert?.(document, arg.position, arg.autoInsertContext),
			(data, sourceMap) => {

				if (!sourceMap)
					return data;

				if (typeof data === 'string')
					return data;

				const range = sourceMap.getSourceRange(data.range.start, data.range.end)?.[0];

				if (range) {
					data.range = range;
					return data;
				}
			},
		);
	};
}
