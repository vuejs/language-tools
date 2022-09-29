import type { DocumentServiceRuntimeContext } from '../types';
import { documentArgFeatureWorker } from '../utils/featureWorkers';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';

export function register(context: DocumentServiceRuntimeContext) {

	return (document: TextDocument, position: vscode.Position) => {

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
			(plugin, document, position) => plugin.findLinkedEditingRanges?.(document, position),
			(data, sourceMap) => ({
				wordPattern: data.wordPattern,
				ranges: data.ranges.map(range => {

					if (!sourceMap)
						return range;

					const start = sourceMap.toSourcePosition(range.start)?.[0];
					const end = sourceMap.toSourcePosition(range.end)?.[0];

					if (start && end) {
						return { start, end };
					}
				}).filter(shared.notEmpty),
			}),
		);
	};
}
