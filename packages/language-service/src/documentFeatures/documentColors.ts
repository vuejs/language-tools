import type { LanguageServiceRuntimeContext } from '../types';
import { documentFeatureWorker } from '../utils/featureWorkers';
import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string) => {

		return documentFeatureWorker(
			context,
			uri,
			file => !!file.capabilities.documentSymbol, // TODO: add color capability setting
			(plugin, document) => plugin.findDocumentColors?.(document),
			(data, map) => data.map(color => {
				const range = map.toSourceRange(color.range);
				if (range) {
					return vscode.ColorInformation.create(range, color.color);
				}
			}).filter(shared.notEmpty),
			arr => arr.flat(),
		);
	};
}
