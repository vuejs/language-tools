import type { DocumentServiceRuntimeContext } from '../types';
import { documentArgFeatureWorker } from '../utils/featureWorkers';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { LanguageServicePlugin } from '@volar/language-service';
import * as vscode from 'vscode-languageserver-protocol';

export function register(context: DocumentServiceRuntimeContext) {

	return (document: TextDocument, position: vscode.Position, options: Parameters<NonNullable<LanguageServicePlugin['doAutoInsert']>>[2]) => {

		return documentArgFeatureWorker(
			context,
			document,
			position,
			sourceMap => true,
			function* (position, sourceMap) {
				for (const mapped of sourceMap.toGeneratedPositions(position)) {
					if (mapped[1].data.completion) {
						yield mapped[0];
					}
				}
			},
			(plugin, document, position) => plugin.doAutoInsert?.(document, position, options),
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
