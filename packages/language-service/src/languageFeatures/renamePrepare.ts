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
			function* (position, sourceMap) {
				for (const [mappedRange] of sourceMap.getMappedRanges(
					position,
					position,
					data => typeof data.rename === 'object' ? !!data.rename.apply : !!data.rename,
				)) {
					yield mappedRange.start;
				}
			},
			(plugin, document, position) => plugin.rename?.prepare?.(document, position),
			(data, sourceMap) => {

				if (sourceMap && vscode.Range.is(data))
					return sourceMap.getSourceRange(data.start, data.end)?.[0];

				return data;
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
