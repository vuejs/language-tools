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
				.map(position => sourceMap.toGeneratedPosition(position))
				.filter(shared.notEmpty)],
			(plugin, document, positions) => positions.length ? plugin.getSelectionRanges?.(document, positions) : undefined,
			(item, sourceMap) => transformSelectionRanges(item, range => sourceMap.toSourceRange(range)),
		);
	};
}
