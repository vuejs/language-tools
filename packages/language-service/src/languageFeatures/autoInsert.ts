import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';
import { LanguageServicePlugin } from '@volar/language-service';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string, position: vscode.Position, autoInsertContext: Parameters<NonNullable<LanguageServicePlugin['doAutoInsert']>>[2]) => {

		return languageFeatureWorker(
			context,
			uri,
			{ position, autoInsertContext },
			function* (arg, sourceMap) {
				for (const position of sourceMap.toGeneratedPositions(arg.position, data => !!data.completion)) {

					const rangeOffset = sourceMap.toGeneratedOffset(arg.autoInsertContext.lastChange.rangeOffset)?.[0];
					const range = sourceMap.toGeneratedRange(arg.autoInsertContext.lastChange.range);

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
			(item, sourceMap) => {

				if (!sourceMap || typeof item === 'string')
					return item;

				const range = sourceMap.toSourceRange(item.range);
				if (range) {
					item.range = range;
					return item;
				}
			},
		);
	};
}
