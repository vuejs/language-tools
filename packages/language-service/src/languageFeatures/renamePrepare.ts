import { getWordRange } from '@volar/shared';
import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';

// https://github.com/microsoft/vscode/blob/dcf27391b7dd7c1cece483806af75b4f87188e70/extensions/html/language-configuration.json#L35
const htmlWordPatterns = /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\\"\,\.\<\>\/\s]+)/g;

export function register(context: LanguageServiceRuntimeContext) {

	return async (uri: string, position: vscode.Position) => {

		const document = context.getTextDocument(uri);
		const result = await languageFeatureWorker(
			context,
			uri,
			position,
			(position, sourceMap) => sourceMap.toGeneratedPositions(position, data => typeof data.rename === 'object' ? !!data.rename.apply : !!data.rename),
			(plugin, document, position) => plugin.rename?.prepare?.(document, position),
			(item, sourceMap) => {
				if (!sourceMap) {
					return item;
				}
				if (vscode.Range.is(item)) {
					return sourceMap.toSourceRange(item);
				}
			},
			prepares => {

				for (const prepare of prepares) {
					if (vscode.Range.is(prepare)) {
						return prepare; // if has any valid range, ignore other errors
					}
				}

				return prepares[0];
			},
		);

		return result ?? (document ? getWordRange(htmlWordPatterns, position, document) : undefined);
	};
}
