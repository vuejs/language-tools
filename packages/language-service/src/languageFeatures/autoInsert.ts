import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServicePluginInstance, LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string, position: vscode.Position, autoInsertContext: Parameters<NonNullable<LanguageServicePluginInstance['doAutoInsert']>>[2]) => {

		return languageFeatureWorker(
			context,
			uri,
			{ position, autoInsertContext },
			function* (arg, map) {
				for (const position of map.toGeneratedPositions(arg.position, data => !!data.completion)) {

					const rangeOffset = map.map.toGeneratedOffset(arg.autoInsertContext.lastChange.rangeOffset)?.[0];
					const range = map.toGeneratedRange(arg.autoInsertContext.lastChange.range);

					if (rangeOffset !== undefined && range) {
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
						break;
					}
				}
			},
			(plugin, document, arg) => plugin.doAutoInsert?.(document, arg.position, arg.autoInsertContext),
			(item, map) => {

				if (!map || typeof item === 'string')
					return item;

				const range = map.toSourceRange(item.range);
				if (range) {
					item.range = range;
					return item;
				}
			},
		);
	};
}
