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
			map => !!map.file.capabilities.documentFormatting,
			(positions, map) => {
				const result = positions
					.map(position => map.toGeneratedPosition(position))
					.filter(shared.notEmpty);
				if (result.length) {
					return [result];
				}
				return [];
			},
			(plugin, document, positions) => plugin.getSelectionRanges?.(document, positions),
			(item, map) => transformSelectionRanges(item, range => map.toSourceRange(range)),
			results => {
				for (let i = 0; i < results[0].length; i++) {
					const first = results[0][i];
					let lastParent = first;
					while (lastParent.parent) {
						lastParent = lastParent.parent;
					}
					for (let j = 1; j < results.length; j++) {
						const other = results[j][i];
						lastParent.parent = other;
						while (lastParent.parent) {
							lastParent = lastParent.parent;
						}
					}
				}
				return results[0];
			},
		);
	};
}
