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
				for (const [mappedRange] of sourceMap.getMappedRanges(
					position,
					position,
					data => !!data.capabilities.completion,
				)) {
					yield mappedRange.start;
				}
			},
			(plugin, document, position) => plugin.findLinkedEditingRanges?.(document, position),
			(data, sourceMap) => ({
				wordPattern: data.wordPattern,
				ranges: data.ranges.map(range => {

					if (!sourceMap)
						return range;

					return sourceMap.getSourceRange(range.start, range.end)?.[0]
				}).filter(shared.notEmpty),
			}),
		);
	}
}
