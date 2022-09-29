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
				for (const start of sourceMap.toGeneratedPositions(range.start)) {
					for (const end of sourceMap.toGeneratedPositions(range.start)) {
						yield { start: start[0], end: end[0] };
						break;
					}
				}
			},
			(plugin, document, range) => plugin.getColorPresentations?.(document, color, range),
			(data, sourceMap) => data.map(cp => {

				if (!sourceMap)
					return cp;

				if (cp.textEdit) {

					const start = sourceMap.toSourcePosition(cp.textEdit.range.start)?.[0];
					const end = sourceMap.toSourcePosition(cp.textEdit.range.end)?.[0];

					if (!start || !end)
						return undefined;

					cp.textEdit.range = { start, end };
				}

				if (cp.additionalTextEdits) {
					for (const textEdit of cp.additionalTextEdits) {

						const start = sourceMap.toSourcePosition(textEdit.range.start)?.[0];
						const end = sourceMap.toSourcePosition(textEdit.range.end)?.[0];

						if (!start || !end)
							return undefined;

						textEdit.range = { start, end };
					}
				}
				return cp;
			}).filter(shared.notEmpty),
		);
	};
}
