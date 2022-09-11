import type { DocumentServiceRuntimeContext } from '../types';
import { documentArgFeatureWorker } from '../utils/featureWorkers';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';

export function register(context: DocumentServiceRuntimeContext) {

	return (document: TextDocument, color: vscode.Color, range: vscode.Range) => {

		return documentArgFeatureWorker(
			context,
			document,
			range,
			sourceMap => !!sourceMap.embeddedFile.capabilities.documentSymbol, // TODO: add color capabilitie setting
			function* (range, sourceMap) {
				for (const [mappedRange] of sourceMap.getMappedRanges(range.start, range.end)) {
					yield mappedRange;
				}
			},
			(plugin, document, range) => plugin.getColorPresentations?.(document, color, range),
			(data, sourceMap) => data.map(cp => {

				if (!sourceMap)
					return cp;

				if (cp.textEdit) {

					const editRange = sourceMap.getSourceRange(cp.textEdit.range.start, cp.textEdit.range.end)?.[0];

					if (!editRange)
						return undefined;

					cp.textEdit.range = editRange;
				}

				if (cp.additionalTextEdits) {
					for (const textEdit of cp.additionalTextEdits) {

						const editRange = sourceMap.getSourceRange(textEdit.range.start, textEdit.range.end)?.[0];

						if (!editRange)
							return undefined;

						textEdit.range = editRange;
					}
				}
				return cp;
			}).filter(shared.notEmpty),
		);
	};
}
