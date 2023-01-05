import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';
import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string, color: vscode.Color, range: vscode.Range) => {

		return languageFeatureWorker(
			context,
			uri,
			range,
			(range, map, file) => {
				if (file.capabilities.documentSymbol) // TODO: add color capability setting
					return map.toGeneratedRanges(range);
				return [];
			},
			(plugin, document, range) => plugin.getColorPresentations?.(document, color, range),
			(data, map) => map ? data.map(cp => {

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
			}).filter(shared.notEmpty) : data,
		);
	};
}
