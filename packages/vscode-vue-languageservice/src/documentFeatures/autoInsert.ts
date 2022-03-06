import type { DocumentServiceRuntimeContext } from '../types';
import { documentArgFeatureWorker } from '../utils/featureWorkers';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { EmbeddedLanguagePlugin } from '../plugins/definePlugin';
import * as vscode from 'vscode-languageserver-protocol';

export function register(context: DocumentServiceRuntimeContext) {

	return (document: TextDocument, position: vscode.Position, options: Parameters<NonNullable<EmbeddedLanguagePlugin['doAutoInsert']>>[2]) => {

		return documentArgFeatureWorker(
			context,
			document,
			position,
			sourceMap => true,
			function* (position, sourceMap) {
				for (const [mapedRange] of sourceMap.getMappedRanges(
					position,
					position,
					data => !!data.capabilities.completion,
				)) {
					yield mapedRange.start;
				}
			},
			(plugin, document, position) => plugin.doAutoInsert?.(document, position, options),
			(data, sourceMap) => {

				if (typeof data === 'string')
					return data;

				const range = sourceMap.getSourceRange(data.range.start, data.range.end)?.[0];

				if (range) {
					data.range = range;
					return data;
				}
			},
		);
	}
}
