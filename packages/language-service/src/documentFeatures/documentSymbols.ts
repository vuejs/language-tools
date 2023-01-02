import type { LanguageServiceRuntimeContext } from '../types';
import { documentFeatureWorker } from '../utils/featureWorkers';
import { transformSymbolInformations } from '@volar/transforms';
import * as vscode from 'vscode-languageserver-protocol';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string) => {

		return documentFeatureWorker(
			context,
			uri,
			file => !!file.capabilities.documentSymbol, // TODO: add color capabilitie setting
			(plugin, document) => plugin.findDocumentSymbols?.(document),
			(data, map) => transformSymbolInformations(
				data,
				location => {
					const range = map.toSourceRange(location.range);
					if (range) {
						// use document.uri instead of map.sourceDocument.uri to fix https://github.com/johnsoncodehk/volar/issues/1925
						return vscode.Location.create(uri, range);
					}
				},
			),
			arr => arr.flat(),
		);
	};
}
