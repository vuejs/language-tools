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
				for (const mapped of sourceMap.toGeneratedPositions(arg.position)) {

					if (!mapped[1].data.completion)
						continue;

					const position = mapped[0];
					const rangeOffset = sourceMap.toGeneratedOffset(arg.autoInsertContext.lastChange.rangeOffset)?.[0];
					const rangeStart = sourceMap.toGeneratedPosition(arg.autoInsertContext.lastChange.range.start)?.[0];
					const rangeEnd = sourceMap.toGeneratedPosition(arg.autoInsertContext.lastChange.range.start)?.[0];

					if (rangeOffset !== undefined && rangeStart && rangeEnd) {
						yield {
							position,
							autoInsertContext: {
								lastChange: {
									...arg.autoInsertContext.lastChange,
									rangeOffset,
									range: { start: rangeStart, end: rangeEnd },
								},
							},
						};
						break;
					}
				}
			},
			(plugin, document, arg) => plugin.doAutoInsert?.(document, arg.position, arg.autoInsertContext),
			(data, sourceMap) => {

				if (!sourceMap)
					return data;

				if (typeof data === 'string')
					return data;

				const start = sourceMap.toSourcePosition(data.range.start)?.[0];
				const end = sourceMap.toSourcePosition(data.range.end)?.[0];

				if (start && end) {
					data.range = { start, end };
					return data;
				}
			},
		);
	};
}
