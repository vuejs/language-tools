import type { DocumentServiceRuntimeContext } from '../types';
import { documentArgFeatureWorker } from '../utils/featureWorkers';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { transformSelectionRanges } from '@volar/transforms';
import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';

export function register(context: DocumentServiceRuntimeContext) {

	return (document: TextDocument, positions: vscode.Position[]) => {

		return documentArgFeatureWorker(
			context,
			document,
			positions,
			sourceMap => !!sourceMap.embeddedFile.capabilities.foldingRange,
			(positions, sourceMap) => [positions
				.map(position => sourceMap.getMappedRange(position, position)?.[0].start)
				.filter(shared.notEmpty)],
			(plugin, document, positions) => positions.length ? plugin.getSelectionRanges?.(document, positions) : undefined,
			(data, sourceMap) => transformSelectionRanges(
				data,
				range => {

					if (!sourceMap)
						return range;

					return sourceMap.getSourceRange(range.start, range.end)?.[0];
				},
			),
		);
	};
}
