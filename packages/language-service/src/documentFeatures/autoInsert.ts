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
			{ position, options },
			() => true,
			function* ({ position, options }, map) {
				for (const mappedPos of map.toGeneratedPositions(position, data => !!data.completion)) {
					for (const [mappedChangeOffset] of map.map.toGeneratedOffsets(options.lastChange.rangeOffset)) {
						yield {
							position: mappedPos,
							options: {
								lastChange: {
									...options.lastChange,
									rangeOffset: mappedChangeOffset,
									range: {
										start: map.virtualFileDocument.positionAt(mappedChangeOffset),
										end: map.virtualFileDocument.positionAt(mappedChangeOffset + options.lastChange.rangeLength),
									},
								}
							}
						};
					}
				}
			},
			(plugin, document, { position, options }) => plugin.doAutoInsert?.(document, position, options),
			(data, map) => {

				if (typeof data === 'string')
					return data;

				const range = map.toSourceRange(data.range);
				if (range) {
					data.range = range;
					return data;
				}
			},
		);
	};
}
