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
			map => !!map.file.capabilities.documentSymbol, // TODO: add color capabilitie setting
			(range, map) => map.toGeneratedRanges(range),
			(plugin, document, range) => plugin.getColorPresentations?.(document, color, range),
			(data, map) => data.map(cp => {

				if (cp.textEdit) {
					const range = map.toSourceRange(cp.textEdit.range);
					if (!range)
						return undefined;
					cp.textEdit.range = range;
				}

				if (cp.additionalTextEdits) {
					for (const textEdit of cp.additionalTextEdits) {
						const range = map.toSourceRange(textEdit.range);
						if (!range)
							return undefined;
						textEdit.range = range;
					}
				}
				return cp;
			}).filter(shared.notEmpty),
		);
	};
}
