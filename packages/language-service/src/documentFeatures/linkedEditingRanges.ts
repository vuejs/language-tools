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
			() => true,
			(position, map) => map.toGeneratedPositions(position, data => !!data.completion),
			(plugin, document, position) => plugin.findLinkedEditingRanges?.(document, position),
			(data, map) => ({
				wordPattern: data.wordPattern,
				ranges: data.ranges.map(range => map.toSourceRange(range)).filter(shared.notEmpty),
			}),
		);
	};
}
